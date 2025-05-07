'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Copy, Table, Download, FileUp, Image as ImageIcon, FileText } from "lucide-react";
import Manual from '@/components/Manual';
import ReactDOM from 'react-dom';

interface Point {
  actualFlow: number;
  actualHead?: number;
  actualEfficiency?: number;
  isEfficiency?: boolean;
}

interface BepPoint {
  actualFlow: number;
  actualHead: number;
  actualEfficiency: number;
}

interface DefaultDataPoint {
  actualFlow: number | string;
  actualHead?: number | string;
  actualEfficiency?: number | string;
  speed?: number | string;
  // Add legacy properties for backward compatibility
  flow?: number | string;
  head?: number | string;
  efficiency?: number | string;
}

interface CaseInfo {
  caseName: string;
  projectName: string;
  stage: string;
  date: string;
  pumpName: string;
  maker: string;
  modelNo: string;
}

interface LoadedData {
  caseInfo: CaseInfo;  // Change from optional to required and use CaseInfo interface
  maxValues?: {
    actualHead?: number;
    actualFlow?: number;
    actualEfficiency?: number;
    rpm?: number;  // Add this line
  };
  equations?: {
    head?: {
      degree?: number;
      equation?: string;
    };
    efficiency?: {
      degree?: number;
      equation?: string;
    };
  };
  points?: {
    headPoints?: DefaultDataPoint[];
    efficiencyPoints?: DefaultDataPoint[];
    vfdPoints?: DefaultDataPoint[];
  };
  bepPoint?: {
    actualFlow: string;
    actualHead: string;
    actualEfficiency: string;
  };
}

interface HistoryState {
  points: Point[];
  efficiencyPoints: Point[];
  vfdPoints: Point[];
}

interface DraggedPoint {
  index: number;
  field: 'efficiency' | 'head';
  type: string;
}

interface ComparisonData {
  points?: {
    headPoints?: DefaultDataPoint[];
    efficiencyPoints?: DefaultDataPoint[];
    vfdPoints?: DefaultDataPoint[];
  };
  maxValues?: {
    actualHead?: number;
    actualFlow?: number;
    actualEfficiency?: number;
  };
}

const PumpCurveNew2: React.FC = () => {
  const [points, setPoints] = useState<Point[]>([]);
  const [efficiencyPoints, setEfficiencyPoints] = useState<Point[]>([]);
  const [vfdPoints, setVfdPoints] = useState<Point[]>([]);
  const [selectedMode, setSelectedMode] = useState<'head' | 'efficiency' | 'vfd'>('head');
  const [headDegree, setHeadDegree] = useState(4);
  const [efficiencyDegree, setEfficiencyDegree] = useState(4);
  const [maxHead, setMaxHead] = useState<number>(100);
  const [maxFlow, setMaxFlow] = useState<number>(100);
  const [maxEfficiency, setMaxEfficiency] = useState<number>(100);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedPoint, setDraggedPoint] = useState<DraggedPoint | null>(null);
  const [dragMode, setDragMode] = useState<'head' | 'efficiency' | 'vfd' | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [headEquation, setHeadEquation] = useState<string>('');
  const [efficiencyEquation, setEfficiencyEquation] = useState<string>('');
  const [caseInfo, setCaseInfo] = useState<CaseInfo>({
    caseName: '',
    projectName: '',
    stage: '수행',
    date: new Date().toISOString().split('T')[0],
    pumpName: '',
    maker: '',
    modelNo: ''
  });
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);
  const [imageOpacity, setImageOpacity] = useState(0.5);
  const [showManual, setShowManual] = useState(false);
  const [copyEffect, setCopyEffect] = useState<string>('');
  const [canvasKey, setCanvasKey] = useState<number>(0);
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState<number>(-1);
  const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null);
  const [maxRpm, setMaxRpm] = useState<number>(100);
  const [tempInputValues, setTempInputValues] = useState<{[key: string]: string}>({});

  // Add refs for previous range values
  const prevMaxFlowRef = useRef(maxFlow);
  const prevMaxHeadRef = useRef(maxHead);

  const sortedPoints = [...points].sort((a, b) => a.actualFlow - b.actualFlow);
  const sortedEfficiencyPoints = [...efficiencyPoints].sort((a, b) => a.actualFlow - b.actualFlow);
  const sortedVfdPoints = [...vfdPoints].sort((a, b) => a.actualFlow - b.actualFlow);

  const calculatePolynomialCoefficients = (xValues: number[], yValues: number[], degree: number) => {
    const X: number[][] = [];
    const y: number[] = [];
    
    for (let i = 0; i < xValues.length; i++) {
      X[i] = Array(degree + 1).fill(0);
      for (let j = 0; j <= degree; j++) {
        X[i][j] = Math.pow(xValues[i], j);
      }
      y[i] = yValues[i];
    }
    
    return solveLinearSystem(X, y);
  };

  const solveLinearSystem = (X: number[][], y: number[]): number[] => {
    const n = X[0].length;
    const m = X.length;
    
    // Calculate X^T * X
    const XtX: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        for (let k = 0; k < m; k++) {
          XtX[i][j] += X[k][i] * X[k][j];
        }
      }
    }
    
    // Calculate X^T * y
    const Xty: number[] = Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < m; j++) {
        Xty[i] += X[j][i] * y[j];
      }
    }
    
    // Solve using Gaussian elimination
    const augmentedMatrix = XtX.map((row, i) => [...row, Xty[i]]);
    
    // Forward elimination
    for (let i = 0; i < n; i++) {
      const pivot = augmentedMatrix[i][i];
      for (let j = i; j <= n; j++) {
        augmentedMatrix[i][j] /= pivot;
      }
      for (let j = i + 1; j < n; j++) {
        const factor = augmentedMatrix[j][i];
        for (let k = i; k <= n; k++) {
          augmentedMatrix[j][k] -= factor * augmentedMatrix[i][k];
        }
      }
    }
    
    // Back substitution
    const solution = Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      solution[i] = augmentedMatrix[i][n];
      for (let j = i + 1; j < n; j++) {
        solution[i] -= augmentedMatrix[i][j] * solution[j];
      }
    }
    
    return solution;
  };

  const calculateActualPolynomialCoefficients = (points: Point[], degree: number) => {
    if (points.length < 2) return [];

    const isEfficiencyPoints = points[0].isEfficiency;
    const actualPoints = points.map(point => ({
      x: point.actualFlow,
      y: isEfficiencyPoints ? point.actualEfficiency! : point.actualHead!
    }));

    const n = actualPoints.length;
    const matrix: number[][] = [];
    const vector: number[] = [];

    for (let i = 0; i < n; i++) {
      const row: number[] = [];
      for (let j = 0; j <= degree; j++) {
        row.push(Math.pow(actualPoints[i].x, j));
      }
      matrix.push(row);
      vector.push(actualPoints[i].y);
    }

    const coefficients = solveLinearSystem(matrix, vector);
    return coefficients.reverse();
  };

  const formatEquation = (coefficients: number[]) => {
    if (coefficients.length === 0) return '';

    return coefficients
      .map((coef, index) => {
        const power = coefficients.length - 1 - index;
        if (power === 0) return coef.toFixed(12);
        if (power === 1) return `${coef.toFixed(12)}x`;
        return `${coef.toFixed(12)}x^${power}`;
      })
      .join(' + ');
  };

  const drawPolynomialTrendline = (
    ctx: CanvasRenderingContext2D, 
    points: Point[], 
    degree: number, 
    color: string,
    padding: { left: number; right: number; top: number; bottom: number },
    drawingWidth: number,
    drawingHeight: number,
    isOpHead: boolean = false
  ) => {
    if (points.length === 0) return;

    // Draw points first
    points.forEach(point => {
      // Convert actual values to canvas coordinates
      const x = padding.left + (point.actualFlow / maxFlow) * drawingWidth;
      const y = padding.top + (1 - (point.isEfficiency ? point.actualEfficiency! : point.actualHead!) / 
        (point.isEfficiency ? maxEfficiency : maxHead)) * drawingHeight;

      ctx.beginPath();
      if (isOpHead) {
        // Draw cross for operation points
        const crossSize = 6;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        // Horizontal line
        ctx.moveTo(x - crossSize, y);
        ctx.lineTo(x + crossSize, y);
        // Vertical line
        ctx.moveTo(x, y - crossSize);
        ctx.lineTo(x, y + crossSize);
        ctx.stroke();
      } else {
        // Draw circle for head and efficiency points
        ctx.fillStyle = color;
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fill();
      }
    });

    // Only draw trendline if we have enough points and not opHead
    if (points.length < 2 || isOpHead) return;

    // Extract x and y values for coefficient calculation using actual values
    const xValues = points.map(point => point.actualFlow);
    const yValues = points.map(point => 
      point.isEfficiency 
        ? point.actualEfficiency!
        : point.actualHead!
    );

    // Calculate coefficients using actual values
    const coefficients = calculatePolynomialCoefficients(xValues, yValues, degree);

    // Draw curve
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;

    const maxFlowPoint = Math.max(...xValues);
    const stepSize = maxFlowPoint / 200;

    let firstPoint = true;
    for (let flow = 0; flow <= maxFlowPoint; flow += stepSize) {
      let y = 0;
      for (let i = 0; i < coefficients.length; i++) {
        y += coefficients[i] * Math.pow(flow, i);
      }
      
      if (points[0].isEfficiency && (y < 0 || y > maxEfficiency)) continue;
      if (!points[0].isEfficiency && (y < 0 || y > maxHead * 1.2)) continue;

      const canvasX = padding.left + (flow / maxFlow) * drawingWidth;
      const canvasY = padding.top + (1 - y / (points[0].isEfficiency ? maxEfficiency : maxHead)) * drawingHeight;
      
      if (firstPoint) {
        ctx.moveTo(canvasX, canvasY);
        firstPoint = false;
      } else {
        ctx.lineTo(canvasX, canvasY);
      }
    }
    ctx.stroke();
  };

  useEffect(() => {
    const handleResize = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

      const container = canvas.parentElement;
      if (!container) return;

      // Get the container's width
      const containerWidth = Math.min(1800, container.clientWidth);
      const aspectRatio = 16/9;
      const calculatedHeight = containerWidth / aspectRatio;
      const maxHeight = 600;

      // Set canvas dimensions
      canvas.width = containerWidth;
      canvas.height = Math.min(calculatedHeight, maxHeight);

      // Force redraw
    const ctx = canvas.getContext('2d');
      if (ctx) {
        drawCanvas(ctx, canvas.width, canvas.height);
      }
    };

    // Initial size setup
    handleResize();

    const resizeObserver = new ResizeObserver(handleResize);
    const container = canvasRef.current?.parentElement;
    if (container) {
      resizeObserver.observe(container);
    }

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
    };
  }, [points, efficiencyPoints, vfdPoints, maxFlow, maxHead, maxEfficiency, backgroundImage, imageOpacity, headDegree, efficiencyDegree, comparisonData]); // Add comparisonData to dependencies

  // Add a new useEffect for immediate canvas updates when comparisonData changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        drawCanvas(ctx, canvas.width, canvas.height);
      }
    }
  }, [comparisonData]);

  // Separate drawing logic into its own function
  const drawCanvas = (
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number
  ) => {
    // Define padding
    const padding = {
      left: Math.round(canvasWidth * 0.07),
      right: Math.round(canvasWidth * 0.07),
      top: Math.round(canvasHeight * 0.033),
      bottom: Math.round(canvasHeight * 0.060)
    };

    const drawingWidth = canvasWidth - padding.left - padding.right;
    const drawingHeight = canvasHeight - padding.top - padding.bottom;

    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Draw background image if exists
    if (backgroundImage) {
      ctx.save();
      ctx.globalAlpha = imageOpacity;
      ctx.drawImage(
        backgroundImage,
        padding.left,
        padding.top,
        drawingWidth,
        drawingHeight
      );
      ctx.restore();
    }

    // Set proportional font sizes based on canvas dimensions
    const FONT_SIZES = {
      axisLabel: `bold ${Math.max(14, Math.min(24, canvasWidth * 0.015))}px Arial`,
      mainValue: `${Math.max(12, Math.min(16, canvasWidth * 0.013))}px Arial`,
      subValue: `${Math.max(10, Math.min(16, canvasWidth * 0.011))}px Arial`
    };

    // Draw grid
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = Math.max(0.5, canvasWidth * 0.0004);

    // Vertical grid lines with actual flow values
    for (let i = 0; i <= 10; i++) {
      const x = padding.left + (drawingWidth / 10) * i;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, canvasHeight - padding.bottom);
      ctx.stroke();

      // Draw actual flow values with adjusted positioning
      const actualFlow = Math.round((i * 10) * maxFlow / 100);  // Changed to Math.round
      ctx.fillStyle = '#000';
      ctx.font = FONT_SIZES.mainValue;
      ctx.textAlign = 'center';
      
      // Adjust text position for first and last labels
      if (i === 0) {
        ctx.textAlign = 'left';
        ctx.fillText(actualFlow.toString(), x, canvasHeight - padding.bottom / 2);
      } else if (i === 10) {
        ctx.textAlign = 'right';
        ctx.fillText(actualFlow.toString(), x, canvasHeight - padding.bottom / 2);
      } else {
        ctx.textAlign = 'center';
        ctx.fillText(actualFlow.toString(), x, canvasHeight - padding.bottom / 2);
      }
    }

    // Horizontal grid lines with percentage and actual values
    for (let i = 0; i <= 10; i++) {
      const y = padding.top + (drawingHeight / 10) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(canvasWidth - padding.right, y);
      ctx.stroke();

      // Calculate actual values
      const percentage = 100 - i * 10;
      const actualHead = Math.round((percentage * maxHead) / 100);
      const actualEfficiency = Math.round((percentage * maxEfficiency) / 100);

      // Draw Head values on the left
      ctx.fillStyle = '#0000FF';
      ctx.font = FONT_SIZES.mainValue;
      ctx.textAlign = 'right';
      ctx.fillText(actualHead.toString(), padding.left - 10, y + 5);

      // Draw Efficiency values on the right
      ctx.fillStyle = '#FF0000';
      ctx.textAlign = 'left';
      ctx.fillText(actualEfficiency.toString(), canvasWidth - padding.right + 10, y + 5);
    }

    // Add Y-axis labels
    ctx.save();
    
    // Left Y-axis label (Head)
    ctx.fillStyle = '#0000FF';
    ctx.translate(20, canvasHeight / 5);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.font = FONT_SIZES.axisLabel;
    // ctx.fillText('Head (actual)', 0, 0);
    
    ctx.restore();
    
    // Right Y-axis label (Efficiency)
    ctx.save();
    ctx.fillStyle = '#FF0000';
    ctx.translate(canvasWidth - 60, canvasHeight / 5);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.font = FONT_SIZES.axisLabel;
    // ctx.fillText('Efficiency (actual)', 0, 0);
    ctx.restore();

    // Draw axes
    ctx.strokeStyle = '#000';
    ctx.lineWidth = Math.max(1, canvasWidth * 0.0008);

    // X-axis
    ctx.beginPath();
    ctx.moveTo(padding.left, canvasHeight - padding.bottom);
    ctx.lineTo(canvasWidth - padding.right, canvasHeight - padding.bottom);
    ctx.stroke();

    // Y-axis
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, canvasHeight - padding.bottom);
    ctx.stroke();

    // Add x-axis label
    ctx.fillStyle = '#000';
    ctx.font = FONT_SIZES.axisLabel;
    ctx.textAlign = 'center';
    // ctx.fillText('Flow (actual)', canvasWidth / 2, canvasHeight - 10);

    // Draw trendlines
    ctx.lineWidth = 2;
    if (points.length > 0) {
      drawPolynomialTrendline(ctx, points, headDegree, '#0000FF', padding, drawingWidth, drawingHeight);
    }
    if (efficiencyPoints.length > 0) {
      drawPolynomialTrendline(ctx, efficiencyPoints, efficiencyDegree, '#FF0000', padding, drawingWidth, drawingHeight);
    }
    if (vfdPoints.length > 0) {
      drawPolynomialTrendline(ctx, vfdPoints, 0, '#00AA00', padding, drawingWidth, drawingHeight, true);
    }

    // Draw BEP line if exists
    const bep = findBepPoint(points, efficiencyPoints);
    if (bep) {
      // Convert BEP point to percentage coordinates
      const bepFlowPercent = (bep.actualFlow / maxFlow) * 100;
      const bepHeadPercent = (bep.actualHead / maxHead) * 100;

      // Draw BEP line (quadratic curve through origin and BEP)
      ctx.beginPath();
      ctx.strokeStyle = '#800080';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]); // Dashed line

      // Calculate quadratic curve through origin and BEP
      const a = bepHeadPercent / (bepFlowPercent * bepFlowPercent);
      
      // Calculate head polynomial coefficients for TDH curve
      const headCoefficients = calculatePolynomialCoefficients(
        points.map(p => (p.actualFlow * 100) / maxFlow), 
        points.map(p => (p.actualHead! * 100) / maxHead), 
        headDegree
      );
      
      // Draw curve up to intersection with TDH curve
      let prevX = 0;
      let prevY = 0;
      for (let x = 0; x <= 100; x += 0.5) {
        const y = a * x * x;
        
        // Calculate TDH curve y value at this x
        const tdhY = headCoefficients.reduce((acc, coeff, index) => acc + coeff * Math.pow(x, index), 0);
        
        const canvasX = padding.left + (x / 100) * drawingWidth;
        const canvasY = padding.top + (1 - y / 100) * drawingHeight;
        
        if (x === 0) {
          ctx.moveTo(canvasX, canvasY);
        } else {
          // Only draw line segment if below or at TDH curve
          if (y <= tdhY) {
            ctx.lineTo(canvasX, canvasY);
          } else if (prevY <= tdhY) {
            // Draw final segment to intersection point
            const ratio = (tdhY - prevY) / (y - prevY);
            const intersectX = prevX + (x - prevX) * ratio;
            const intersectCanvasX = padding.left + (intersectX / 100) * drawingWidth;
            const intersectCanvasY = padding.top + (1 - tdhY / 100) * drawingHeight;
            ctx.lineTo(intersectCanvasX, intersectCanvasY);
            break;
          }
        }
        prevX = x;
        prevY = y;
      }
      
      ctx.stroke();
      ctx.setLineDash([]); // Reset dash pattern

      // Draw "BEP line" label near the curve but horizontally
      const labelX = bepFlowPercent * 0.5;
      const labelY = a * labelX * labelX;
      
      const labelCanvasX = padding.left + (labelX / 100) * drawingWidth;
      const labelCanvasY = padding.top + (1 - labelY / 100) * drawingHeight - 10;

      ctx.save();
      ctx.fillStyle = '#800080';
      ctx.font = FONT_SIZES.mainValue;
      ctx.textAlign = 'center';
      ctx.fillText('BEP Line', labelCanvasX, labelCanvasY);
      ctx.restore();
    }

    // Draw quadratic curves through second and last operating points
    if (points.length > 1) {
      // Calculate head polynomial coefficients for TDH curve once
      const headCoefficients = calculatePolynomialCoefficients(
        points.map(p => (p.actualFlow * 100) / maxFlow), 
        points.map(p => (p.actualHead! * 100) / maxHead), 
        headDegree
      );

      // Second operating point curve (blue)
      const secondPoint = points[1];
      const secondPointFlow = secondPoint.actualFlow;
      const secondPointHead = secondPoint.actualHead!;
      const a1 = secondPointHead / (secondPointFlow * secondPointFlow);

      ctx.beginPath();
      ctx.strokeStyle = '#0000FF';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);

      let prevX = 0;
      let prevY = 0;
      let xCanvas = 0;
      let yCanvas = 0;

      for (let x = 0; x <= 100; x += 0.5) {
        const xActual = (x * maxFlow) / 100;
        const yActual = a1 * xActual * xActual;
        const y = (yActual * 100) / maxHead;
        
        // Calculate TDH curve y value at this x
        const tdhY = headCoefficients.reduce((acc, coeff, index) => acc + coeff * Math.pow(x, index), 0);
        
        xCanvas = padding.left + x * drawingWidth / 100;
        yCanvas = padding.top + (1 - y / 100) * drawingHeight;
        
        if (x === 0) {
          ctx.moveTo(xCanvas, yCanvas);
        } else {
          if (y <= tdhY) {
            ctx.lineTo(xCanvas, yCanvas);
          } else if (prevY <= tdhY) {
            // Draw final segment to intersection point
            const ratio = (tdhY - prevY) / (y - prevY);
            const intersectX = prevX + (x - prevX) * ratio;
            const intersectCanvasX = padding.left + (intersectX / 100) * drawingWidth;
            const intersectCanvasY = padding.top + (1 - tdhY / 100) * drawingHeight;
            ctx.lineTo(intersectCanvasX, intersectCanvasY);
            break;
          }
        }
        prevX = x;
        prevY = y;
      }
      ctx.stroke();

      // Draw "Min Flow" label
      const labelFlow1 = secondPoint.actualFlow * 0.7;
      const labelHead1 = a1 * labelFlow1 * labelFlow1;
      
      const labelCanvasX1 = padding.left + (labelFlow1 * 100 / maxFlow) * drawingWidth / 100;
      const labelCanvasY1 = padding.top + (1 - labelHead1 * 100 / maxHead / 100) * drawingHeight - 10;

      ctx.save();
      ctx.fillStyle = '#0000FF';
      ctx.font = FONT_SIZES.mainValue;
      ctx.textAlign = 'center';
      ctx.fillText('Min Flow', labelCanvasX1, labelCanvasY1);
      ctx.restore();

      // Find point with maximum flow
      const maxFlowPoint = points.reduce((max, current) => 
        current.actualFlow > max.actualFlow ? current : max
      , points[0]);

      // Maximum flow point curve (blue)
      const maxFlowPointFlow = maxFlowPoint.actualFlow;
      const maxFlowPointHead = maxFlowPoint.actualHead!;
      const a2 = maxFlowPointHead / (maxFlowPointFlow * maxFlowPointFlow);

      ctx.beginPath();
      ctx.strokeStyle = '#0000FF';
      ctx.lineWidth = 1;

      prevX = 0;
      prevY = 0;
      for (let x = 0; x <= 100; x += 0.5) {
        const xActual = (x * maxFlow) / 100;
        const yActual = a2 * xActual * xActual;
        const y = (yActual * 100) / maxHead;
        
        // Calculate TDH curve y value at this x
        const tdhY = headCoefficients.reduce((acc, coeff, index) => acc + coeff * Math.pow(x, index), 0);
        
        xCanvas = padding.left + x * drawingWidth / 100;
        yCanvas = padding.top + (1 - y / 100) * drawingHeight;
        
        if (x === 0) {
          ctx.moveTo(xCanvas, yCanvas);
        } else {
          if (y <= tdhY) {
            ctx.lineTo(xCanvas, yCanvas);
          } else if (prevY <= tdhY) {
            // Draw final segment to intersection point
            const ratio = (tdhY - prevY) / (y - prevY);
            const intersectX = prevX + (x - prevX) * ratio;
            const intersectCanvasX = padding.left + (intersectX / 100) * drawingWidth;
            const intersectCanvasY = padding.top + (1 - tdhY / 100) * drawingHeight;
            ctx.lineTo(intersectCanvasX, intersectCanvasY);
            break;
          }
        }
        prevX = x;
        prevY = y;
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw "Max Flow" label
      const labelFlow2 = maxFlowPoint.actualFlow * 0.7;
      const labelHead2 = a2 * labelFlow2 * labelFlow2;
      
      const labelCanvasX2 = padding.left + (labelFlow2 * 100 / maxFlow) * drawingWidth / 100;
      const labelCanvasY2 = padding.top + (1 - labelHead2 * 100 / maxHead / 100) * drawingHeight - 10;

      ctx.save();
      ctx.fillStyle = '#0000FF';
      ctx.font = FONT_SIZES.mainValue;
      ctx.textAlign = 'center';
      ctx.fillText('Max Flow', labelCanvasX2, labelCanvasY2);
      ctx.restore();
    }

    // Draw comparison case curves if available
    if (comparisonData?.points) {
      ctx.lineWidth = 3; // Increased from 2 to 3 (1.5x thicker)
      ctx.strokeStyle = '#808080'; // Gray color for comparison curves
      ctx.setLineDash([]); // Solid line for comparison curves

      // Draw comparison head points and curve
      if (comparisonData.points.headPoints && comparisonData.points.headPoints.length > 0) {
        const comparisonHeadPoints = comparisonData.points.headPoints.map(point => ({
          actualFlow: Math.max(0, Math.min(maxFlow, Number(point.actualFlow))),
          actualHead: Math.max(0, Math.min(maxHead, Number(point.actualHead)))
        })).filter(point => !isNaN(point.actualFlow) && !isNaN(point.actualHead));

        if (comparisonHeadPoints.length > 0) {
          drawPolynomialTrendline(ctx, comparisonHeadPoints, headDegree, '#808080', padding, drawingWidth, drawingHeight);
        }
      }

      // Draw comparison efficiency points and curve
      if (comparisonData.points.efficiencyPoints && comparisonData.points.efficiencyPoints.length > 0) {
        const comparisonEffPoints = comparisonData.points.efficiencyPoints.map(point => ({
          actualFlow: Math.max(0, Math.min(maxFlow, Number(point.actualFlow))),
          actualEfficiency: Math.max(0, Math.min(maxEfficiency, Number(point.actualEfficiency))),
          isEfficiency: true
        })).filter(point => !isNaN(point.actualFlow) && !isNaN(point.actualEfficiency));

        if (comparisonEffPoints.length > 0) {
          drawPolynomialTrendline(ctx, comparisonEffPoints, efficiencyDegree, '#808080', padding, drawingWidth, drawingHeight);
        }
      }

      // Draw comparison VFD points
      if (comparisonData.points.vfdPoints && comparisonData.points.vfdPoints.length > 0) {
        const comparisonVfdPoints = comparisonData.points.vfdPoints.map(point => ({
          actualFlow: Math.max(0, Math.min(maxFlow, Number(point.actualFlow))),
          actualHead: Math.max(0, Math.min(maxHead, Number(point.actualHead)))
        })).filter(point => !isNaN(point.actualFlow) && !isNaN(point.actualHead));

        if (comparisonVfdPoints.length > 0) {
          drawPolynomialTrendline(ctx, comparisonVfdPoints, 0, '#808080', padding, drawingWidth, drawingHeight, true);
        }
      }
      
      ctx.setLineDash([]); // Reset dash pattern
    }

    // Draw main case curves on top
    ctx.lineWidth = 2; // Reset to normal width for main case
    if (points.length > 0) {
      drawPolynomialTrendline(ctx, points, headDegree, '#0000FF', padding, drawingWidth, drawingHeight);
    }
    if (efficiencyPoints.length > 0) {
      drawPolynomialTrendline(ctx, efficiencyPoints, efficiencyDegree, '#FF0000', padding, drawingWidth, drawingHeight);
    }
    if (vfdPoints.length > 0) {
      drawPolynomialTrendline(ctx, vfdPoints, 0, '#00AA00', padding, drawingWidth, drawingHeight, true);
    }
  };

  useEffect(() => {
    const newCaseName = [
      caseInfo.projectName,
      caseInfo.stage,
      caseInfo.pumpName,
      caseInfo.maker,
      caseInfo.modelNo,
      caseInfo.date
    ]
      .filter(Boolean) // Remove empty values
      .join('_');
    
    if (newCaseName !== caseInfo.caseName) {
      setCaseInfo(prev => ({ ...prev, caseName: newCaseName }));
    }
  }, [caseInfo.projectName, caseInfo.stage, caseInfo.pumpName, caseInfo.maker, caseInfo.modelNo, caseInfo.date]);

  const findClosestPoint = (points: Point[], mouseX: number, mouseY: number): Point | null => {
    if (!canvasRef.current) return null;
    
    const canvas = canvasRef.current;
    const padding = {
      left: Math.round(canvas.width * 0.07),
      right: Math.round(canvas.width * 0.07),
      top: Math.round(canvas.height * 0.033),
      bottom: Math.round(canvas.height * 0.060)
    };

    const drawingWidth = canvas.width - padding.left - padding.right;
    const drawingHeight = canvas.height - padding.top - padding.bottom;

    let minDistance = Infinity;
    let closestPoint: Point | null = null;

    points.forEach(point => {
      // Convert actual values to canvas coordinates
      const canvasX = padding.left + (point.actualFlow / maxFlow) * drawingWidth;
      const canvasY = padding.top + (1 - (point.isEfficiency ? point.actualEfficiency! : point.actualHead!) / 
        (point.isEfficiency ? maxEfficiency : maxHead)) * drawingHeight;

      const dx = mouseX - canvasX;
      const dy = mouseY - canvasY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Consider a point "close enough" if it's within 20 pixels
      if (distance < minDistance && distance < 20) {
        minDistance = distance;
        closestPoint = point;
      }
    });

    return closestPoint;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    // Check each type of points in order: head, efficiency, vfd
    let closestPoint = findClosestPoint(points, mouseX, mouseY);
    if (closestPoint) {
      e.preventDefault();
      const index = points.indexOf(closestPoint);
      setDraggedPoint({
        index,
        field: 'head',
        type: 'head'
      });
      setIsDragging(true);
      setDragMode('head');
      return;
    }

    closestPoint = findClosestPoint(efficiencyPoints, mouseX, mouseY);
    if (closestPoint) {
      e.preventDefault();
      const index = efficiencyPoints.indexOf(closestPoint);
      setDraggedPoint({
        index,
        field: 'efficiency',
        type: 'efficiency'
      });
      setIsDragging(true);
      setDragMode('efficiency');
      return;
    }

    closestPoint = findClosestPoint(vfdPoints, mouseX, mouseY);
    if (closestPoint) {
      e.preventDefault();
      const index = vfdPoints.indexOf(closestPoint);
      setDraggedPoint({
        index,
        field: 'head',
        type: 'vfd'
      });
      setIsDragging(true);
      setDragMode('vfd');
      return;
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !isDragging || !draggedPoint) return;

    e.preventDefault();
    e.stopPropagation();

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    const padding = {
      left: Math.round(canvas.width * 0.07),
      right: Math.round(canvas.width * 0.07),
      top: Math.round(canvas.height * 0.033),
      bottom: Math.round(canvas.height * 0.060)
    };

    const drawingWidth = canvas.width - padding.left - padding.right;
    const drawingHeight = canvas.height - padding.top - padding.bottom;

    // Calculate the percentage of the position within the drawing area
    const xPercent = (mouseX - padding.left) / drawingWidth;
    const yPercent = (mouseY - padding.top) / drawingHeight;

    // Convert to actual values
    const actualFlow = xPercent * maxFlow;
    const actualValue = (1 - yPercent) * (draggedPoint.field === 'efficiency' ? maxEfficiency : maxHead);

    // Create updated point with new values
    const updatedPoint: Point = {
      actualFlow: Math.max(0, Math.min(maxFlow, actualFlow)),
      ...(draggedPoint.field === 'efficiency'
        ? { 
            actualEfficiency: Math.max(0, Math.min(maxEfficiency, actualValue)),
            isEfficiency: true 
          }
        : { actualHead: Math.max(0, Math.min(maxHead, actualValue)) }
      )
    };

    // Update the appropriate array
    if (draggedPoint.type === 'efficiency') {
      const newPoints = [...efficiencyPoints];
      newPoints[draggedPoint.index] = updatedPoint;
      setEfficiencyPoints(newPoints);
    } else if (draggedPoint.type === 'head') {
      const newPoints = [...points];
      newPoints[draggedPoint.index] = updatedPoint;
      setPoints(newPoints);
    } else if (draggedPoint.type === 'vfd') {
      const newPoints = [...vfdPoints];
      newPoints[draggedPoint.index] = updatedPoint;
      setVfdPoints(newPoints);
    }

    // Force redraw
    const ctx = canvas.getContext('2d');
    if (ctx) {
      drawCanvas(ctx, canvas.width, canvas.height);
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      e.preventDefault();
      e.stopPropagation();
      
      // Save the final state to history only when dragging ends
      if (draggedPoint) {
        let newPoints = [...points];
        let newEfficiencyPoints = [...efficiencyPoints];
        let newVfdPoints = [...vfdPoints];
        saveToHistory(newPoints, newEfficiencyPoints, newVfdPoints);
      }
    }
    setIsDragging(false);
    setDraggedPoint(null);
    setDragMode(null);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Prevent creating new points if we just finished dragging
    if (!canvasRef.current || isDragging || dragMode || e.isPropagationStopped()) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    // Calculate padding
    const padding = {
      left: Math.round(canvas.width * 0.07),
      right: Math.round(canvas.width * 0.07),
      top: Math.round(canvas.height * 0.033),
      bottom: Math.round(canvas.height * 0.060)
    };

    // Check if we clicked near any existing point (from any mode)
    const headPoint = findClosestPoint(points, mouseX, mouseY);
    const effPoint = findClosestPoint(efficiencyPoints, mouseX, mouseY);
    const vfdPoint = findClosestPoint(vfdPoints, mouseX, mouseY);
    
    if (headPoint || effPoint || vfdPoint) return; // Don't create new point if near any existing point

    // Calculate drawing dimensions
    const drawingWidth = canvas.width - padding.left - padding.right;
    const drawingHeight = canvas.height - padding.top - padding.bottom;

    // Check if click is within the drawing area
    if (mouseX < padding.left || mouseX > canvas.width - padding.right ||
        mouseY < padding.top || mouseY > canvas.height - padding.bottom) {
      return;
    }

    // Calculate the percentage of the click position within the drawing area
    const xPercent = (mouseX - padding.left) / drawingWidth;
    const yPercent = (mouseY - padding.top) / drawingHeight;

    // Convert to actual values (note the 1 - yPercent to invert Y axis)
    const actualFlow = xPercent * maxFlow;
    const actualValue = (1 - yPercent) * (selectedMode === 'efficiency' ? maxEfficiency : maxHead);

    // Create a new point with actual values
    const newPoint: Point = {
      actualFlow: Math.max(0, Math.min(maxFlow, actualFlow)),
      ...(selectedMode === 'efficiency'
        ? { 
            actualEfficiency: Math.max(0, Math.min(maxEfficiency, actualValue)),
            isEfficiency: true 
          }
        : { actualHead: Math.max(0, Math.min(maxHead, actualValue)) }
      )
    };

    // Add the new point to the appropriate array
    if (selectedMode === 'efficiency') {
      setEfficiencyPoints(prev => [...prev, newPoint]);
    } else if (selectedMode === 'head') {
      setPoints(prev => [...prev, newPoint]);
    } else if (selectedMode === 'vfd') {
      setVfdPoints(prev => [...prev, newPoint]);
    }

    // Save to history
    const newHistoryState = {
      points: selectedMode === 'head' ? [...points, newPoint] : points,
      efficiencyPoints: selectedMode === 'efficiency' ? [...efficiencyPoints, newPoint] : efficiencyPoints,
      vfdPoints: selectedMode === 'vfd' ? [...vfdPoints, newPoint] : vfdPoints
    };

    setHistory(prev => [...prev.slice(0, currentHistoryIndex + 1), newHistoryState]);
    setCurrentHistoryIndex(prev => prev + 1);

    // Force redraw
    const ctx = canvas.getContext('2d');
    if (ctx) {
      drawCanvas(ctx, canvas.width, canvas.height);
    }
  };

  const handleEditPoint = (index: number, type: 'head' | 'efficiency' | 'vfd', actualFlow: number, actualValue: number) => {
    let newPoints = [...points];
    let newEfficiencyPoints = [...efficiencyPoints];
    let newVfdPoints = [...vfdPoints];

    if (type === 'head') {
      newPoints[index] = { 
        actualFlow,
        actualHead: actualValue
      };
      setPoints(newPoints);
    } else if (type === 'efficiency') {
      newEfficiencyPoints[index] = { 
        actualFlow,
        actualEfficiency: actualValue,
        isEfficiency: true
      };
      setEfficiencyPoints(newEfficiencyPoints);
    } else if (type === 'vfd') {
      newVfdPoints[index] = { 
        actualFlow,
        actualHead: actualValue
      };
      setVfdPoints(newVfdPoints);
    }

    saveToHistory(newPoints, newEfficiencyPoints, newVfdPoints);
  };

  const handleDeletePoint = (index: number, type: 'head' | 'efficiency' | 'vfd') => {
    let newPoints = [...points];
    let newEfficiencyPoints = [...efficiencyPoints];
    let newVfdPoints = [...vfdPoints];

    if (type === 'head') {
      newPoints = points.filter((_, i) => i !== index);
      setPoints(newPoints);
    } else if (type === 'efficiency') {
      newEfficiencyPoints = efficiencyPoints.filter((_, i) => i !== index);
      setEfficiencyPoints(newEfficiencyPoints);
    } else if (type === 'vfd') {
      newVfdPoints = vfdPoints.filter((_, i) => i !== index);
      setVfdPoints(newVfdPoints);
    }

    saveToHistory(newPoints, newEfficiencyPoints, newVfdPoints);
  };

  const handleCopyWithEffect = (action: () => void, buttonId: string) => {
    action();
    setCopyEffect(buttonId);
    setTimeout(() => setCopyEffect(''), 500);
  };

  const handleCopyEquation = (equation: string, buttonId: string) => {
    navigator.clipboard.writeText(equation);
    setCopyEffect(buttonId);
    setTimeout(() => setCopyEffect(''), 500);
  };

  const handleCopyAllPoints = () => {
    const headData = sortedPoints.map((point, index) => ({
      no: index + 1,
      flow: point.actualFlow.toFixed(1),
      head: point.actualHead!.toFixed(1)
    }));

    const efficiencyData = sortedEfficiencyPoints.map((point, index) => ({
      no: index + 1,
      flow: point.actualFlow.toFixed(1),
      efficiency: point.actualEfficiency!.toFixed(1)
    }));

    const vfdData = sortedVfdPoints.map((point, index) => {
      const { speedRatio, vfdEfficiency } = calculateVfdEfficiency(point);
      return {
        no: index + 1,
        flow: point.actualFlow.toFixed(1),
        head: point.actualHead!.toFixed(1),
        speed: speedRatio.toFixed(1),
        efficiency: vfdEfficiency.toFixed(1)
      };
    });

    // Create table format string
    let tableText = "Head Points:\n";
    tableText += "No\tFlow\tHead\n";
    headData.forEach(row => {
      tableText += `${row.no}\t${row.flow}\t${row.head}\n`;
    });

    tableText += "\nEfficiency Points:\n";
    tableText += "No\tFlow\tEfficiency\n";
    efficiencyData.forEach(row => {
      tableText += `${row.no}\t${row.flow}\t${row.efficiency}\n`;
    });

    tableText += "\nVFD Points:\n";
    tableText += "No\tFlow\tHead\tSpeed\tEfficiency\n";
    vfdData.forEach(row => {
      tableText += `${row.no}\t${row.flow}\t${row.head}\t${row.speed}\t${row.efficiency}\n`;
    });

    navigator.clipboard.writeText(tableText);
  };

  const handleExportJson = () => {
    // Calculate equations
    const headCoefficients = calculateActualPolynomialCoefficients(points, headDegree);
    const efficiencyCoefficients = calculateActualPolynomialCoefficients(efficiencyPoints, efficiencyDegree);

    // Find BEP point
    const bep = findBepPoint(points, efficiencyPoints);

    const data: LoadedData = {
      caseInfo,
      maxValues: {
        actualHead: maxHead,
        actualFlow: maxFlow,
        actualEfficiency: maxEfficiency,
        rpm: maxRpm
      },
      equations: {
        head: {
          degree: headDegree,
          equation: headCoefficients ? formatEquation(headCoefficients) : ''
        },
        efficiency: {
          degree: efficiencyDegree,
          equation: efficiencyCoefficients ? formatEquation(efficiencyCoefficients) : ''
        }
      },
      points: {
        headPoints: sortedPoints.map(point => ({
          actualFlow: point.actualFlow.toFixed(1),
          actualHead: point.actualHead!.toFixed(1)
        })),
        efficiencyPoints: sortedEfficiencyPoints.map(point => ({
          actualFlow: point.actualFlow.toFixed(1),
          actualEfficiency: point.actualEfficiency!.toFixed(1)
        })),
        vfdPoints: sortedVfdPoints.map(point => {
          const { speedRatio, vfdEfficiency } = calculateVfdEfficiency(point);
          return {
            actualFlow: point.actualFlow.toFixed(1),
            actualHead: point.actualHead!.toFixed(1),
            speed: speedRatio.toFixed(1),
            actualEfficiency: vfdEfficiency.toFixed(1)
          };
        })
      },
      bepPoint: bep ? {
        actualFlow: bep.actualFlow.toFixed(1),
        actualHead: bep.actualHead.toFixed(1),
        actualEfficiency: bep.actualEfficiency.toFixed(1)
      } : undefined
    };

    // Create blob and download
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${caseInfo.caseName || 'pump_data'}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      const data = JSON.parse(content);

      // Reset all states first
      setPoints([]);
      setEfficiencyPoints([]);
      setVfdPoints([]);
      setHistory([]);
      setCurrentHistoryIndex(-1);
      setBackgroundImage(null);
      setImageOpacity(0.5);

      // Prepare all new states
      const newMaxValues = {
        actualHead: Number(data.maxValues?.actualHead) || Number(data.maxValues?.head) || 100,
        actualFlow: Number(data.maxValues?.actualFlow) || Number(data.maxValues?.flow) || 100,
        actualEfficiency: Number(data.maxValues?.actualEfficiency) || Number(data.maxValues?.efficiency) || 100,
        rpm: Number(data.maxValues?.rpm) || 1800
      };

      const newCaseInfo = {
        caseName: data.caseInfo?.caseName || '',
        projectName: data.caseInfo?.projectName || '',
        stage: data.caseInfo?.stage || '수행',
        date: data.caseInfo?.date || new Date().toISOString().split('T')[0],
        pumpName: data.caseInfo?.pumpName || '',
        maker: data.caseInfo?.maker || '',
        modelNo: data.caseInfo?.modelNo || ''
      };

      const newDegrees = {
        head: data.equations?.head?.degree >= 2 && data.equations?.head?.degree <= 4 
          ? Number(data.equations.head.degree) 
          : 4,
        efficiency: data.equations?.efficiency?.degree >= 2 && data.equations?.efficiency?.degree <= 4 
          ? Number(data.equations.efficiency.degree) 
          : 4
      };

      // Convert points with actual values
      const newPoints: Point[] = [];
      const newEfficiencyPoints: Point[] = [];
      const newVfdPoints: Point[] = [];

      if (Array.isArray(data.points?.headPoints)) {
        data.points.headPoints.forEach((point: { [key: string]: any }) => {
          // Convert old format to new format if needed
          const actualFlow = point.actualFlow || point.flow;
          const actualHead = point.actualHead || point.head;
          
          if (actualFlow !== undefined && actualHead !== undefined) {
            const validPoint = {
              actualFlow: Number(actualFlow),
              actualHead: Number(actualHead)
            };
            if (!isNaN(validPoint.actualFlow) && !isNaN(validPoint.actualHead)) {
              newPoints.push(validPoint);
            }
          }
        });
      }

      if (Array.isArray(data.points?.efficiencyPoints)) {
        data.points.efficiencyPoints.forEach((point: { [key: string]: any }) => {
          // Convert old format to new format if needed
          const actualFlow = point.actualFlow || point.flow;
          const actualEfficiency = point.actualEfficiency || point.efficiency;
          
          if (actualFlow !== undefined && actualEfficiency !== undefined) {
            const validPoint = {
              actualFlow: Number(actualFlow),
              actualEfficiency: Number(actualEfficiency),
              isEfficiency: true
            };
            if (!isNaN(validPoint.actualFlow) && !isNaN(validPoint.actualEfficiency)) {
              newEfficiencyPoints.push(validPoint);
            }
          }
        });
      }

      if (Array.isArray(data.points?.vfdPoints)) {
        data.points.vfdPoints.forEach((point: { [key: string]: any }) => {
          // Convert old format to new format if needed
          const actualFlow = point.actualFlow || point.flow;
          const actualHead = point.actualHead || point.head;
          
          if (actualFlow !== undefined && actualHead !== undefined) {
            const validPoint = {
              actualFlow: Number(actualFlow),
              actualHead: Number(actualHead)
            };
            if (!isNaN(validPoint.actualFlow) && !isNaN(validPoint.actualHead)) {
              newVfdPoints.push(validPoint);
            }
          }
        });
      }

      // Create new history state
      const newHistory = [{
        points: newPoints,
        efficiencyPoints: newEfficiencyPoints,
        vfdPoints: newVfdPoints
      }];

      // Update all states in a single batch
      ReactDOM.flushSync(() => {
        // Set max values first
        setMaxHead(newMaxValues.actualHead);
        setMaxFlow(newMaxValues.actualFlow);
        setMaxEfficiency(newMaxValues.actualEfficiency);
        setMaxRpm(newMaxValues.rpm);

        // Set other states
        setCaseInfo(newCaseInfo);
        setHeadDegree(newDegrees.head);
        setEfficiencyDegree(newDegrees.efficiency);
        
        // Set points and history
        setPoints(newPoints);
        setEfficiencyPoints(newEfficiencyPoints);
        setVfdPoints(newVfdPoints);
        setHistory(newHistory);
        setCurrentHistoryIndex(0);

        // Force canvas redraw
        setCanvasKey(prev => prev + 1);
      });

    } catch (error) {
      console.error('Error loading data:', error);
      alert('데이터 로드 중 오류가 발생했습니다.');
    }

    // Reset the input
    e.target.value = '';
  };

  // Load data from sessionStorage on component mount
  useEffect(() => {
    const savedData = sessionStorage.getItem('tempPumpCurveData');
    const pendingFile = sessionStorage.getItem('pendingJsonFile');
    
    if (savedData && pendingFile) {
      try {
        // Clear storage first
        sessionStorage.removeItem('tempPumpCurveData');
        sessionStorage.removeItem('pendingJsonFile');

        // Reset all states
        setPoints([]);
        setEfficiencyPoints([]);
        setVfdPoints([]);
        setHistory([]);
        setCurrentHistoryIndex(-1);
        setHeadEquation('');
        setEfficiencyEquation('');
        setBackgroundImage(null);
        setImageOpacity(0.5);
        setCanvasKey(prev => prev + 1);

        // Parse and load the data
        const data = JSON.parse(savedData);
        
        // Set case info
        if (data.caseInfo && typeof data.caseInfo === 'object') {
          setCaseInfo({
            caseName: data.caseInfo.caseName || '',
            projectName: data.caseInfo.projectName || '',
            stage: data.caseInfo.stage || '수행',
            date: data.caseInfo.date || new Date().toISOString().split('T')[0],
            pumpName: data.caseInfo.pumpName || '',
            maker: data.caseInfo.maker || '',
            modelNo: data.caseInfo.modelNo || ''
          });
        }

        // Set max values
        if (data.maxValues && typeof data.maxValues === 'object') {
          const { actualHead = 100, actualFlow = 100, actualEfficiency = 100, rpm = 1800 } = data.maxValues;
          setMaxHead(Number(actualHead) || 100);
          setMaxFlow(Number(actualFlow) || 100);
          setMaxEfficiency(Number(actualEfficiency) || 100);
          setMaxRpm(Number(rpm) || 1800);
        }

        // Set polynomial degrees
        if (data.equations?.head?.degree) {
          const degree = Number(data.equations.head.degree);
          setHeadDegree(degree >= 2 && degree <= 4 ? degree : 4);
        }
        if (data.equations?.efficiency?.degree) {
          const degree = Number(data.equations.efficiency.degree);
          setEfficiencyDegree(degree >= 2 && degree <= 4 ? degree : 4);
        }

        // Helper function to validate point data
        const validatePoint = (point: { [key: string]: any }): Point | null => {
          if (!point || typeof point !== 'object') return null;
          
          // Convert old format to new format if needed
          const actualFlow = point.actualFlow || point.flow;
          const actualHead = point.actualHead || point.head;
          const actualEfficiency = point.actualEfficiency || point.efficiency;
          
          const flow = Number(actualFlow);
          const head = Number(actualHead);
          const efficiency = Number(actualEfficiency);
          
          if (isNaN(flow)) return null;
          if (isNaN(head) && isNaN(efficiency)) return null;
          
          if (!isNaN(head)) {
          return {
              actualFlow: flow,
              actualHead: head
            };
          } else if (!isNaN(efficiency)) {
            return {
              actualFlow: flow,
              actualEfficiency: efficiency,
              isEfficiency: true
            };
          }
          return null;
        };

        // Convert and set points
        const headPoints: Point[] = [];
        const efficiencyPoints: Point[] = [];
        const vfdPoints: Point[] = [];

        if (Array.isArray(data.points?.headPoints)) {
          data.points.headPoints.forEach((point: DefaultDataPoint) => {
            const validPoint = validatePoint({
              actualFlow: point.actualFlow,
              actualHead: point.actualHead
            });
            if (validPoint) headPoints.push(validPoint);
          });
        }

        if (Array.isArray(data.points?.efficiencyPoints)) {
          data.points.efficiencyPoints.forEach((point: DefaultDataPoint) => {
            const validPoint = validatePoint({
              actualFlow: point.actualFlow,
              actualEfficiency: point.actualEfficiency
            });
            if (validPoint) efficiencyPoints.push(validPoint);
          });
        }

        if (Array.isArray(data.points?.vfdPoints)) {
          data.points.vfdPoints.forEach((point: DefaultDataPoint) => {
            const validPoint = validatePoint({
              actualFlow: point.actualFlow,
              actualHead: point.actualHead
            });
            if (validPoint) vfdPoints.push(validPoint);
          });
        }

        // Set points
        setPoints(headPoints);
        setEfficiencyPoints(efficiencyPoints);
        setVfdPoints(vfdPoints);

        // Initialize history with loaded data
        setHistory([{
          points: headPoints,
          efficiencyPoints: efficiencyPoints,
          vfdPoints: vfdPoints
        }]);
        setCurrentHistoryIndex(0);

        // Set equations if available
        if (data.equations?.head?.equation) {
          setHeadEquation(data.equations.head.equation);
        }
        if (data.equations?.efficiency?.equation) {
          setEfficiencyEquation(data.equations.efficiency.equation);
        }

        // Force canvas redraw
        setTimeout(() => {
          setCanvasKey(prev => prev + 1);
        }, 100);

      } catch (error) {
        console.error('Error parsing saved data:', error);
        alert('데이터 로드 중 오류가 발생했습니다.');
      }
    }
  }, []);

  // Add paste event listener
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (!file) continue;

          const img = new Image();
          img.src = URL.createObjectURL(file);
          img.onload = () => {
            setBackgroundImage(img);
            setCanvasKey(prev => prev + 1); // Force canvas rerender when background image is loaded
            URL.revokeObjectURL(img.src);
          };
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  // Add clear background image function
  const clearBackgroundImage = () => {
    setBackgroundImage(null);
    setCanvasKey(prev => prev + 1); // Force canvas rerender when background image is cleared
  };

  // Add equation calculation effect
  useEffect(() => {
    // Calculate and set equations
    const headCoefficients = calculateActualPolynomialCoefficients(points, headDegree);
    const efficiencyCoefficients = calculateActualPolynomialCoefficients(efficiencyPoints, efficiencyDegree);
    
    setHeadEquation(headCoefficients ? formatEquation(headCoefficients) : '');
    setEfficiencyEquation(efficiencyCoefficients ? formatEquation(efficiencyCoefficients) : '');

    // Force canvas redraw when degrees change
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        drawCanvas(ctx, canvas.width, canvas.height);
      }
    }
  }, [points, efficiencyPoints, headDegree, efficiencyDegree]);

  const handleClearAllPoints = () => {
    setPoints([]);
    setEfficiencyPoints([]);
    setVfdPoints([]);
    saveToHistory([], [], []);
  };

  // Add undo/redo functions
  const undo = () => {
    if (currentHistoryIndex > 0) {
      const previousState = history[currentHistoryIndex - 1];
      setPoints([...previousState.points]);
      setEfficiencyPoints([...previousState.efficiencyPoints]);
      setVfdPoints([...previousState.vfdPoints]);
      setCurrentHistoryIndex(currentHistoryIndex - 1);
    }
  };

  const redo = () => {
    if (currentHistoryIndex < history.length - 1) {
      const nextState = history[currentHistoryIndex + 1];
      setPoints([...nextState.points]);
      setEfficiencyPoints([...nextState.efficiencyPoints]);
      setVfdPoints([...nextState.vfdPoints]);
      setCurrentHistoryIndex(currentHistoryIndex + 1);
    }
  };

  // Update keyboard shortcut handler
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey) {
        if (e.key === 'z') {
          e.preventDefault();
          undo();
        } else if (e.key === 'y') {
          e.preventDefault();
          redo();
        } else if (e.key === 'e') {
          e.preventDefault();
          setSelectedMode((prev: 'head' | 'efficiency' | 'vfd') => {
            return prev === 'head' ? 'efficiency' : prev === 'efficiency' ? 'vfd' : 'head';
          });
        } else if (e.key === 'x') {
          e.preventDefault();
          handleClearAllPoints();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentHistoryIndex, history]);

  // Initialize history with empty state
  useEffect(() => {
    if (history.length === 0) {
      saveToHistory([], [], []);
    }
  }, []);

  // Update calculateVfdEfficiency function
  const calculateVfdEfficiency = (vfdPoint: Point): { speedRatio: number; vfdEfficiency: number } => {
    if (points.length < 2 || efficiencyPoints.length < 2) return { speedRatio: 0, vfdEfficiency: 0 };

    // Get actual values
    const vfdFlow = vfdPoint.actualFlow;
    const vfdHead = vfdPoint.actualHead || 0;

    // Calculate head polynomial coefficients
    const headCoefficients = calculateActualPolynomialCoefficients(points, headDegree);
    if (!headCoefficients.length) return { speedRatio: 0, vfdEfficiency: 0 };

    // Get actual values and calculate base head
    const baseHead = headCoefficients.reduce((sum, coeff, index) => {
      return sum + coeff * Math.pow(vfdFlow, headCoefficients.length - 1 - index);
    }, 0);

    // Calculate speed ratio using affinity law: H2/H1 = (N2/N1)^2
    const speedRatio = Math.sqrt(Math.max(0.1, vfdHead / Math.max(0.1, baseHead)));

    // Calculate quadratic coefficient for VFD point curve (y = ax²)
    const a = vfdHead / Math.max(0.0001, vfdFlow * vfdFlow);

    // Find intersection point with head curve using binary search
    let intersectionFlow = vfdFlow;  // Start with VFD flow as initial guess
    const numIterations = 100;
    const epsilon = 0.0001;
    let left = 0;
    let right = maxFlow * 1.5;  // Extend search range slightly

    for (let i = 0; i < numIterations; i++) {
      const mid = (left + right) / 2;
      
      // Calculate y-value on VFD quadratic curve
      const vfdY = a * mid * mid;
      
      // Calculate y-value on head curve
      const headY = headCoefficients.reduce((sum, coeff, index) => {
        return sum + coeff * Math.pow(mid, headCoefficients.length - 1 - index);
      }, 0);

      if (Math.abs(vfdY - headY) < epsilon) {
        intersectionFlow = mid;
        break;
      }

      if (vfdY < headY) {
        left = mid;
      } else {
        right = mid;
      }
    }

    // Ensure intersection flow is within valid range
    intersectionFlow = Math.max(0, Math.min(maxFlow, intersectionFlow));

    // Calculate efficiency polynomial coefficients
    const efficiencyCoefficients = calculateActualPolynomialCoefficients(efficiencyPoints, efficiencyDegree);
    if (!efficiencyCoefficients.length) return { speedRatio: 0, vfdEfficiency: 0 };

    // Calculate efficiency at the intersection flow point
    let vfdEfficiency = efficiencyCoefficients.reduce((sum, coeff, index) => {
      return sum + coeff * Math.pow(intersectionFlow, efficiencyCoefficients.length - 1 - index);
    }, 0);

    // Ensure efficiency is non-negative and within reasonable bounds
    vfdEfficiency = Math.max(0, Math.min(maxEfficiency, vfdEfficiency));

    return {
      speedRatio: speedRatio * 100, // Convert to percentage
      vfdEfficiency: vfdEfficiency  // Efficiency at intersection point
    };
  };

  // Update findBepPoint function
  const findBepPoint = (points: Point[], efficiencyPoints: Point[]): BepPoint | null => {
    if (efficiencyPoints.length < 2) return null;

    // Calculate efficiency polynomial coefficients
    const efficiencyCoefficients = calculateActualPolynomialCoefficients(
      efficiencyPoints,
      efficiencyDegree
    );

    if (!efficiencyCoefficients.length) return null;

    // Find maximum efficiency point by sampling points
    let maxEff = -Infinity;
    let bepFlow = 0;
    
    // Sample 1000 points to find maximum
    const numSamples = 1000;
    const maxFlowPoint = Math.max(...efficiencyPoints.map(p => p.actualFlow));
    
    for (let i = 0; i <= numSamples; i++) {
      const flow = (i * maxFlowPoint) / numSamples;
      const efficiency = efficiencyCoefficients.reduce((sum, coeff, index) => {
        return sum + coeff * Math.pow(flow, efficiencyCoefficients.length - 1 - index);
      }, 0);

      if (efficiency > maxEff) {
        maxEff = efficiency;
        bepFlow = flow;
      }
    }

    // Calculate head at BEP flow
    const headCoefficients = calculateActualPolynomialCoefficients(points, headDegree);
    if (!headCoefficients.length) return null;

    const bepHead = headCoefficients.reduce((sum, coeff, index) => {
      return sum + coeff * Math.pow(bepFlow, headCoefficients.length - 1 - index);
    }, 0);

    return {
      actualFlow: bepFlow,
      actualHead: bepHead,
      actualEfficiency: maxEff
    };
  };

  // Add new function to save state to history
  const saveToHistory = (newPoints: Point[], newEfficiencyPoints: Point[], newVfdPoints: Point[]) => {
    const newState: HistoryState = {
      points: [...newPoints],
      efficiencyPoints: [...newEfficiencyPoints],
      vfdPoints: [...newVfdPoints]
    };

    // Remove any future states if we're not at the end of the history
    const newHistory = history.slice(0, currentHistoryIndex + 1);
    
    // Add new state to history
    setHistory([...newHistory, newState]);
    setCurrentHistoryIndex(currentHistoryIndex + 1);
  };

  // Add loadComparisonCase function
  const loadComparisonCase = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result;
        if (typeof content === 'string') {
          const data = JSON.parse(content);
          
          // Transform the data points to use actual values
          if (data.points) {
            // Transform head points
            if (data.points.headPoints) {
              data.points.headPoints = data.points.headPoints.map((point: DefaultDataPoint) => ({
                actualFlow: point.actualFlow ? Number(point.actualFlow) : Number(point.flow),
                actualHead: point.actualHead ? Number(point.actualHead) : Number(point.head)
              }));
            }
            
            // Transform efficiency points
            if (data.points.efficiencyPoints) {
              data.points.efficiencyPoints = data.points.efficiencyPoints.map((point: DefaultDataPoint) => ({
                actualFlow: point.actualFlow ? Number(point.actualFlow) : Number(point.flow),
                actualEfficiency: point.actualEfficiency ? Number(point.actualEfficiency) : Number(point.efficiency)
              }));
            }
            
            // Transform VFD points
            if (data.points.vfdPoints) {
              data.points.vfdPoints = data.points.vfdPoints.map((point: DefaultDataPoint) => ({
                actualFlow: point.actualFlow ? Number(point.actualFlow) : Number(point.flow),
                actualHead: point.actualHead ? Number(point.actualHead) : Number(point.head)
              }));
            }
          }
          
          setComparisonData(data);
        }
      } catch (error) {
        console.error('Error parsing comparison case:', error);
        alert('비교 케이스 로드 중 오류가 발생했습니다.');
      }
    };
    reader.readAsText(file);
  };

  // Update useEffect for handling range changes
  useEffect(() => {
    // Only update canvas positions when range changes, keeping actual values intact
    const newPoints = points.map(point => ({
      ...point
    }));
    setPoints(newPoints);

    const newEfficiencyPoints = efficiencyPoints.map(point => ({
      ...point
    }));
    setEfficiencyPoints(newEfficiencyPoints);

    const newVfdPoints = vfdPoints.map(point => ({
      ...point
    }));
    setVfdPoints(newVfdPoints);

    // Update refs with current values
    prevMaxFlowRef.current = maxFlow;
    prevMaxHeadRef.current = maxHead;
  }, [maxFlow, maxHead, maxEfficiency, points, efficiencyPoints, vfdPoints]);

  // Handlers for form inputs
  const handleFormInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>, 
    field: 'projectName' | 'stage' | 'date' | 'pumpName' | 'maxHead' | 'maxFlow' | 'maxEfficiency' | 'maxRpm' | 'maker' | 'modelNo'
  ) => {
    const value = e.target.value;
    
    // For case info fields, update immediately
    if (field === 'projectName' || field === 'stage' || field === 'date' || field === 'pumpName' || field === 'maker' || field === 'modelNo') {
      setCaseInfo(prev => ({ ...prev, [field]: value }));
    } else {
      // For numeric fields, keep using temp values
      setTempInputValues(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleFormInputBlur = (
    e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>,
    field: 'projectName' | 'stage' | 'date' | 'pumpName' | 'maxHead' | 'maxFlow' | 'maxEfficiency' | 'maxRpm' | 'maker' | 'modelNo'
  ) => {
    const value = e.target.value;
    setTempInputValues(prev => {
      const newValues = { ...prev };
      delete newValues[field];
      return newValues;
    });

    // Only handle numeric fields here since case info fields are handled in onChange
    if (field === 'maxHead' || field === 'maxFlow' || field === 'maxEfficiency' || field === 'maxRpm') {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        switch (field) {
          case 'maxHead':
            setMaxHead(numValue || 100);
            break;
          case 'maxFlow':
            setMaxFlow(numValue || 100);
            break;
          case 'maxEfficiency':
            setMaxEfficiency(numValue || 100);
            break;
          case 'maxRpm':
            setMaxRpm(numValue || 1800);
            break;
        }
      }
    }
  };

  const handleFormInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  // Handlers for table inputs
  const handleTableInputChange = (e: React.ChangeEvent<HTMLInputElement>, index: number, type: 'head' | 'efficiency' | 'vfd', field: 'flow' | 'head' | 'efficiency') => {
    const key = `${type}-${index}-${field}`;
    setTempInputValues(prev => ({ ...prev, [key]: e.target.value }));
  };

  const handleTableInputBlur = (e: React.FocusEvent<HTMLInputElement>, index: number, type: 'head' | 'efficiency' | 'vfd', field: 'flow' | 'head' | 'efficiency') => {
    const numValue = parseFloat(e.target.value);
    if (isNaN(numValue)) return;

    const key = `${type}-${index}-${field}`;
    setTempInputValues(prev => {
      const newValues = { ...prev };
      delete newValues[key];
      return newValues;
    });

    if (field === 'flow') {
      handleEditPoint(index, type, numValue, type === 'head' ? points[index].actualHead! : type === 'efficiency' ? efficiencyPoints[index].actualEfficiency! : vfdPoints[index].actualHead!);
    } else if (field === 'head') {
      handleEditPoint(index, type, type === 'head' ? points[index].actualFlow : vfdPoints[index].actualFlow, numValue);
    } else if (field === 'efficiency') {
      handleEditPoint(index, type, efficiencyPoints[index].actualFlow, numValue);
    }
  };

  const handleTableInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault(); // Prevent default context menu

    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    // Check each type of points
    const headPoint = findClosestPoint(points, mouseX, mouseY);
    if (headPoint) {
      const index = points.indexOf(headPoint);
      const newPoints = points.filter((_, i) => i !== index);
      setPoints(newPoints);
      saveToHistory(newPoints, efficiencyPoints, vfdPoints);
      return;
    }

    const effPoint = findClosestPoint(efficiencyPoints, mouseX, mouseY);
    if (effPoint) {
      const index = efficiencyPoints.indexOf(effPoint);
      const newEffPoints = efficiencyPoints.filter((_, i) => i !== index);
      setEfficiencyPoints(newEffPoints);
      saveToHistory(points, newEffPoints, vfdPoints);
      return;
    }

    const vfdPoint = findClosestPoint(vfdPoints, mouseX, mouseY);
    if (vfdPoint) {
      const index = vfdPoints.indexOf(vfdPoint);
      const newVfdPoints = vfdPoints.filter((_, i) => i !== index);
      setVfdPoints(newVfdPoints);
      saveToHistory(points, efficiencyPoints, newVfdPoints);
      return;
    }
  };

  return (
    <Card className="max-w-[1800px] mx-auto min-w-[600px]">
      <CardContent className="p-4 bg-gray-300">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex-1 min-w-[200px] max-w-[400px]">
              <div className="flex items-center gap-2">
                <Label htmlFor="caseName" className="text-xs whitespace-nowrap">Case 명:</Label>
                <Input
                  id="caseName"
                  value={caseInfo.caseName}
                  readOnly
                  className="flex-1 bg-yellow-200 h-8 text-xs"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="json-file-input"
                  title="Select JSON file to load"
                  aria-label="Select JSON file to load"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById('json-file-input')?.click()}
                  className="flex items-center gap-2 h-8 bg-red-50 hover:bg-red-100 text-xs whitespace-nowrap"
                >
                  <FileUp className="h-4 w-4" />
                  Load Case
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearAllPoints}
                className="flex items-center gap-2 h-8 bg-red-50 hover:bg-red-100 text-xs whitespace-nowrap"
                title="단축키: CTRL+X"
              >
                <Trash2 className="h-4 w-4" />
                Clear Case
              </Button>
              <div className="relative">
                <input
                  type="file"
                  accept=".json"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      loadComparisonCase(file);
                    }
                    e.target.value = '';
                  }}
                  className="hidden"
                  id="comparison-file-input"
                  title="Select JSON file to load as comparison"
                  aria-label="Select JSON file to load as comparison"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById('comparison-file-input')?.click()}
                  className="flex items-center gap-2 h-8 bg-red-50 hover:bg-red-100 text-xs whitespace-nowrap"
                >
                  <FileUp className="h-4 w-4" />
                  Load Comparison
                </Button>
              </div>
              {comparisonData && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setComparisonData(null);
                    const canvas = canvasRef.current;
                    if (canvas) {
                      const ctx = canvas.getContext('2d');
                      if (ctx) {
                        requestAnimationFrame(() => {
                          drawCanvas(ctx, canvas.width, canvas.height);
                        });
                      }
                    }
                  }}
                  className="flex items-center gap-2 h-8 bg-red-50 hover:bg-red-100 text-xs whitespace-nowrap"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear Comparison
                </Button>
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="h-8 text-xs bg-gray-50 hover:bg-gray-200" size="sm" onClick={() => setShowManual(true)}>
                  <FileText className="w-4 h-4 mr-2" />
                  Manual
                </Button>
                {/* Other buttons */}
              </div>
            </div>
          </div>
          <hr className="border-gray-700" />
          <div className="flex flex-wrap justify-between items-center bg-gray-300">
            <div className="flex flex-wrap gap-2 flex-grow">
              <div className="flex items-center gap-2 ">
                <Label htmlFor="projectName" className="text-xs whitespace-nowrap">PJT:</Label>
                <Input
                  id="projectName"
                  value={caseInfo.projectName}
                  onChange={(e) => handleFormInputChange(e, 'projectName')}
                  className="flex-1 bg-white h-8 w-20 text-xs"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="stage" className="text-xs whitespace-nowrap">단계:</Label>
                <select
                  id="stage"
                  title="단계 선택"
                  value={caseInfo.stage}
                  onChange={(e) => handleFormInputChange(e, 'stage')}
                  className="flex-1 text-xs rounded-md border border-input bg-background px-3 py-2 h-8.5 min-w-[100px] bg-white"
                >
                  <option value="수행">수행</option>
                  <option value="견적">견적</option>
                  <option value="기타">기타</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="date" className="text-xs whitespace-nowrap">Date:</Label>
                <Input
                  id="date"
                  type="date"
                  value={caseInfo.date}
                  onChange={(e) => handleFormInputChange(e, 'date')}
                  className="flex-1 bg-white h-9 min-w-[120px] text-xs"
                />
              </div>
              <div className="flex items-center gap-2 min-w-[150px]">
                <Label htmlFor="pumpName" className="text-xs whitespace-nowrap">Pump Name:</Label>
                <Input
                  id="pumpName"
                  value={caseInfo.pumpName}
                  onChange={(e) => handleFormInputChange(e, 'pumpName')}
                  className="flex-1 bg-white h-9  w-20 text-xs"
                />
              </div>
              <div className="flex items-center gap-2 ">
                <Label htmlFor="maker" className="text-xs whitespace-nowrap">Maker:</Label>
                <Input
                  id="maker"
                  value={caseInfo.maker}
                  onChange={(e) => handleFormInputChange(e, 'maker')}
                  className="flex-1 bg-white h-9 w-20 text-xs"
                />
              </div>
              <div className="flex items-center gap-2 min-w-[150px]">
                <Label htmlFor="modelNo" className="text-xs whitespace-nowrap">Model No:</Label>
                <Input
                  id="modelNo"
                  value={caseInfo.modelNo}
                  onChange={(e) => handleFormInputChange(e, 'modelNo')}
                  className="flex-1 bg-white h-9  w-20 text-xs"
                />
              </div>
            </div>
              </div>

          <hr className="border-gray-700" />

          <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2">
              <Label htmlFor="maxHead" className="text-xs">TDH Range:</Label>
              <Input
                id="maxHead"
                type="number"
                value={tempInputValues['maxHead'] ?? maxHead}
                onChange={(e) => handleFormInputChange(e, 'maxHead')}
                onBlur={(e) => handleFormInputBlur(e, 'maxHead')}
                onKeyDown={(e) => handleFormInputKeyDown(e)}
                className="w-24 h-8 bg-white text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="maxFlow" className="text-xs">Flow Range:</Label>
              <Input
                id="maxFlow"
                type="number"
                value={tempInputValues['maxFlow'] ?? maxFlow}
                onChange={(e) => handleFormInputChange(e, 'maxFlow')}
                onBlur={(e) => handleFormInputBlur(e, 'maxFlow')}
                onKeyDown={(e) => handleFormInputKeyDown(e)}
                className="w-24 h-8 bg-white text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="maxEfficiency" className="text-xs">Eff. Range:</Label>
              <Input
                id="maxEfficiency"
                type="number"
                value={tempInputValues['maxEfficiency'] ?? maxEfficiency}
                onChange={(e) => handleFormInputChange(e, 'maxEfficiency')}
                onBlur={(e) => handleFormInputBlur(e, 'maxEfficiency')}
                onKeyDown={(e) => handleFormInputKeyDown(e)}
                className="w-24 h-8 bg-white text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="maxRpm" className="text-xs">RPM(100%):</Label>
              <Input
                id="maxRpm"
                type="number"
                value={tempInputValues['maxRpm'] ?? maxRpm}
                onChange={(e) => handleFormInputChange(e, 'maxRpm')}
                onBlur={(e) => handleFormInputBlur(e, 'maxRpm')}
                onKeyDown={(e) => handleFormInputKeyDown(e)}
                className="w-24 h-8 bg-white text-xs"
              />
            </div>
            <div className="flex items-center gap-4">
              <Label className="font-medium text-xs">Record mode:</Label>
              <div className="flex items-center bg-white rounded-lg border border-gray-200">
                <button
                  onClick={() => {
                    setSelectedMode('head');
                  }}
                  title="단축키: CTRL+E"
                  className={`px-2 py-2 rounded-md text-xs font-medium transition-all duration-200 border ${
                    selectedMode === 'head'
                      ? 'bg-white text-blue-600 border-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-blue-600 border-transparent hover:border-blue-300'
                  }`}
            >
              Head
                </button>
                <button
                  onClick={() => {
                    setSelectedMode('efficiency');
                  }}
                  title="단축키: CTRL+E"
                  className={`px-2 py-2 rounded-md text-xs font-medium transition-all duration-200 border ${
                    selectedMode === 'efficiency'
                      ? 'bg-white text-red-600 border-red-600 shadow-sm'
                      : 'text-gray-600 hover:text-red-600 border-transparent hover:border-red-300'
                  }`}
                >
                  Eff.
                </button>
                <button
                  onClick={() => {
                    setSelectedMode('vfd');
                  }}
                  title="단축키: CTRL+E"
                  className={`px-2 py-2 rounded-md text-xs font-medium transition-all duration-200 border ${
                    selectedMode === 'vfd'
                      ? 'bg-white text-green-600 border-green-600 shadow-sm'
                      : 'text-gray-600 hover:text-green-600 border-transparent hover:border-green-300'
                  }`}
                >
                  OP
                </button>
                </div>
            </div>
            </div>

          <div className="border rounded-lg bg-white p-6">
          
            <div className="flex justify-between bg-gray-100 p-2 max-w-[1800px] mx-auto">
            {/* Add image controls */}
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center">
                <div className="flex items-center">
                  <Label htmlFor="imageOpacity" className="font-medium text-xs">B/G Opacity:</Label>
                <Input
                  id="imageOpacity"
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={imageOpacity}
                      onChange={(e) => setImageOpacity(parseFloat(e.target.value))}
                  className="w-32"
                    />
                  <span className="font-medium text-xs">{(imageOpacity * 100).toFixed(0)}%</span>
                  </div>
              {backgroundImage && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearBackgroundImage}
                  className="flex items-center gap-2"
                >
                  <ImageIcon className="h-4 w-4" />
                  Clear Background
                </Button>
              )}
          </div>
            </div>

            <div className="flex gap-2">

    <span className="mr-1 font-medium text-xs text-gray-700">Head Degree:</span>
    <div className="flex gap-1">
      {[2, 3, 4].map((degree) => (
        <button
          key={degree}
          onClick={() => setHeadDegree(degree)}
          className={`w-5 h-5 text-xs rounded-sm transition-all duration-200 ${
            headDegree === degree
              ? 'bg-blue-600 text-white shadow-lg scale-105 border-2 border-blue-600'
              : 'bg-white text-gray-600 hover:bg-blue-50 border border-gray-300'
          }`}
        >
          {degree}
        </button>
      ))}
    </div>


    <span className="mr-3 font-medium text-xs text-gray-700">Eff. Degree:</span>
    <div className="flex gap-1">
      {[2, 3, 4].map((degree) => (
        <button
          key={degree}
          onClick={() => setEfficiencyDegree(degree)}
          className={`w-5 h-5 text-xs rounded-sm  transition-all duration-200 ${
            efficiencyDegree === degree
              ? 'bg-red-600 text-white shadow-lg scale-105 border-2 border-red-600'
              : 'bg-white text-gray-600 hover:bg-red-50 border border-gray-300'
          }`}
        >
          {degree}
        </button>
      ))}
  </div>

  </div>
</div>

            <div className="w-full max-w-[1800px] mx-auto">
              <div className="flex justify-between px-0">
                <h3 className="text-blue-600 font-semibold text-sm">TDH(m)</h3>  
                <h3 className="text-red-500 font-semibold text-sm">Efficiency(%)</h3>
              </div>
             
            <canvas
                  key={canvasKey}
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={isDragging ? handleMouseMove : undefined}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onClick={(e) => {
                if (isDragging || dragMode) {
                  e.preventDefault();
                  e.stopPropagation();
                  return;
                }
                handleCanvasClick(e);
              }}
              onContextMenu={handleContextMenu}
                  className="w-full h-auto"
                  style={{ 
                    cursor: isDragging ? 'grabbing' : 'crosshair',
                    maxHeight: '900px'
                  }}
                />
             
              <h3 className="text-center font-semibold text-sm">Flowrate(m³/h)</h3>
            </div>
            
            {/* Move trend line equations here */}
            <hr className="border-t border-gray-300" />
            
            <div className=" px-2">
              {headEquation && (
                <div className="flex items-center gap-2 px-2 bg-gray-50 rounded-lg ">
                  <div className="flex-grow max-w-[1200px] overflow-hidden">
                    <span className="font-semibold text-sm text-blue-600">TDH = </span>
                    <span className="font-mono whitespace-nowrap overflow-x-auto">{headEquation}</span>
                  </div>
                  <div className="flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                      onClick={() => handleCopyEquation(headEquation, 'head-equation')}
                      className={`flex items-center h-6 gap-2 transition-colors duration-200 ${
                        copyEffect === 'head-equation' ? 'bg-green-100 text-gray-400 border-gray-400' : ''
                      }`}
                  >
                    <Copy className="h-4 w-4" />
                    Copy
                  </Button>
                  </div>
                          </div>
              )}

              {efficiencyEquation && (
                <div className="flex items-center gap-2 px-2 bg-gray-50 rounded-lg ">
                  <div className="flex-grow max-w-[1200px] overflow-hidden">
                    <span className="font-semibold  text-sm text-red-600">Efficiency = </span>
                    <span className="font-mono whitespace-nowrap overflow-x-auto">{efficiencyEquation}</span>
                  </div>
                  <div className="flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                      onClick={() => handleCopyEquation(efficiencyEquation, 'efficiency-equation')}
                      className={`flex items-center gap-2  h-6 transition-colors duration-200 ${
                        copyEffect === 'efficiency-equation' ? 'bg-green-100 text-gray-400 border-gray-400' : ''
                      }`}
                >
                  <Copy className="h-4 w-4" />
                    Copy
                </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-0">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-semibold">-Records-</h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyWithEffect(handleCopyAllPoints, 'copy-points')}
                  className={`flex items-center gap-2 transition-colors duration-200 bg-red-50 hover:bg-red-100 text-xs ${
                    copyEffect === 'copy-points' ? 'bg-green-100 text-green-700 border-gray-400' : ''
                  }`}
                >
                  <Table className="h-4 w-4" />
                  Copy to Clipboard
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportJson}
                  className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-xs"
                >
                  <Download className="h-4 w-4" />
                  Export JSON
                </Button>
              </div>
            </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">


            <div className='grid grid-cols-2 gap-2'>
            <div className="max-w-[800px] rounded-lg">
                  <h3 className="text-xs text-blue-600 font-semibold">Performance Curve Points</h3>
              <table className="w-full border-collapse table-fixed bg-white">
                <colgroup>
                  <col className="w-[6%]" />
                  <col className="w-[18%]" />
                  <col className="w-[15%]" />
                  <col className="w-[8%]" />
                </colgroup>
                <thead>
                  <tr>
                    <th className="border p-1 text-left">No</th>
                    <th className="border p-1 text-left">Flow(m³/h)</th>
                    <th className="border p-1 text-left">TDH(m)</th>
                    <th className="border p-1 text-left">Del.</th>
                  </tr>
                </thead>
                <tbody>


                  
                  {sortedPoints.map((point, index) => (
                    <tr key={index}>
                      <td className="border p-1 text-left">{index + 1}</td>
                      <td className="border p-1 text-left">
                        <input
                            type="number"
                          value={tempInputValues[`head-${index}-flow`] ?? point.actualFlow.toFixed(1)}
                          onChange={(e) => handleTableInputChange(e, index, 'head', 'flow')}
                          onBlur={(e) => handleTableInputBlur(e, index, 'head', 'flow')}
                          onKeyDown={(e) => handleTableInputKeyDown(e)}
                          className="w-14 h-6"
                          title={`Edit flow for head point ${index + 1}`}
                          placeholder="Flow"
                        />
                      </td>
                      <td className="border p-1 text-left">
                        <input
                            type="number"
                          value={tempInputValues[`head-${index}-head`] ?? point.actualHead!.toFixed(1)}
                          onChange={(e) => handleTableInputChange(e, index, 'head', 'head')}
                          onBlur={(e) => handleTableInputBlur(e, index, 'head', 'head')}
                          onKeyDown={(e) => handleTableInputKeyDown(e)}
                          className="w-14 h-6"
                          title={`Edit head for head point ${index + 1}`}
                          placeholder="Head"
                        />
                      </td>
                      <td className="border p-1 text-left">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeletePoint(index, 'head')}
                          className="h-6 w-6"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="max-w-[800px] rounded-lg">
              <h3 className="text-xs text-red-700 font-semibold">Efficiency Curve Points</h3>
              <table className="w-full border-collapse table-fixed bg-white">
                <colgroup>
                  <col className="w-[6%]" />
                  <col className="w-[18%]" />
                  <col className="w-[15%]" />
                  <col className="w-[8%]" />
                </colgroup>
                <thead>
                  <tr>
                    <th className="border p-1 text-left">No</th>
                    <th className="border p-1 text-left">Flow(m³/h)</th>
                    <th className="border p-1 text-left">Eff.(%)</th>
                    <th className="border p-1 text-left">Del.</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedEfficiencyPoints.map((point, index) => (
                    <tr key={index}>
                      <td className="border p-1 text-left">{index + 1}</td>
                      <td className="border p-1 text-left">
                        <input
                            type="number"
                          value={tempInputValues[`efficiency-${index}-flow`] ?? point.actualFlow.toFixed(1)}
                          onChange={(e) => handleTableInputChange(e, index, 'efficiency', 'flow')}
                          onBlur={(e) => handleTableInputBlur(e, index, 'efficiency', 'flow')}
                          onKeyDown={(e) => handleTableInputKeyDown(e)}
                          className="w-14 h-6"
                          title={`Edit flow for efficiency point ${index + 1}`}
                          placeholder="Flow"
                        />
                      </td>
                      <td className="border p-1 text-left">
                        <input
                          type="number"
                          value={tempInputValues[`efficiency-${index}-efficiency`] ?? point.actualEfficiency!.toFixed(1)}
                          onChange={(e) => handleTableInputChange(e, index, 'efficiency', 'efficiency')}
                          onBlur={(e) => handleTableInputBlur(e, index, 'efficiency', 'efficiency')}
                          onKeyDown={(e) => handleTableInputKeyDown(e)}
                          className="w-14 h-6"
                          title={`Edit efficiency for efficiency point ${index + 1}`}
                          placeholder="Efficiency"
                        />
                      </td>
                      <td className="border p-1 text-left">
                    <Button
                      variant="ghost"
                      size="icon"
                          onClick={() => handleDeletePoint(index, 'efficiency')}
                          className="h-6 w-6"
                    >
                          <Trash2 className="h-3 w-3" />
                    </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
                </div>
            </div>



            <div className="max-w-[800px] rounded-lg">
              <h3 className="text-xs text-green-700 font-semibold">Operating Points</h3>
              <table className="w-full border-collapse table-fixed bg-white">
                <colgroup>
                  <col className="w-[5%]" />
                  <col className="w-[13%]" />
                  <col className="w-[10%]" />
                  <col className="w-[11%]" />
                  <col className="w-[13%]" />
                  <col className="w-[9%]" />
                  <col className="w-[5%]" />
                </colgroup>
                <thead>
                  <tr>
                    <th className="border p-1 text-left">No</th>
                    <th className="border p-1 text-left">Flow(m³/h)</th>
                    <th className="border p-1 text-left">TDH(m)</th>
                    <th className="border p-1 text-left">Speed(%)</th>
                    <th className="border p-1 text-left">Speed(rpm)</th>
                    <th className="border p-1 text-left">Eff.(%)</th>
                    <th className="border p-1 text-left">Del.</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedVfdPoints.map((point, index) => {
                    const { speedRatio, vfdEfficiency } = calculateVfdEfficiency(point);
                    const rpm = (speedRatio * maxRpm) / 100;
                    
                    return (
                      <tr key={index}>
                        <td className="border p-1 text-left">{index + 1}</td>
                        <td className="border p-1 text-left">
                          <input
                            type="number"
                            value={tempInputValues[`vfd-${index}-flow`] ?? point.actualFlow.toFixed(1)}
                            onChange={(e) => handleTableInputChange(e, index, 'vfd', 'flow')}
                            onBlur={(e) => handleTableInputBlur(e, index, 'vfd', 'flow')}
                            onKeyDown={(e) => handleTableInputKeyDown(e)}
                            className="w-14 h-6"
                            title={`Edit flow for VFD point ${index + 1}`}
                            placeholder="Flow"
                          />
                        </td>
                        <td className="border p-1 text-left">
                          <input
                            type="number"
                            value={tempInputValues[`vfd-${index}-head`] ?? point.actualHead!.toFixed(1)}
                            onChange={(e) => handleTableInputChange(e, index, 'vfd', 'head')}
                            onBlur={(e) => handleTableInputBlur(e, index, 'vfd', 'head')}
                            onKeyDown={(e) => handleTableInputKeyDown(e)}
                            className="w-14 h-6"
                            title={`Edit head for VFD point ${index + 1}`}
                            placeholder="Head"
                          />
                        </td>
                        <td className="border p-1 text-left">
                          {speedRatio.toFixed(1)}
                        </td>
                        <td className="border p-1 text-left">
                          {rpm.toFixed(0)}
                        </td>
                        <td className="border p-1 text-left">
                          {vfdEfficiency.toFixed(1)}
                        </td>
                        <td className="border p-1 text-left">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeletePoint(index, 'vfd')}
                            className="h-6 w-6"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

         </div>
              </div>
            </div>
          </CardContent>

      {/* Manual component */}
      <Manual open={showManual} onOpenChange={setShowManual} />
    </Card>
  );
};

export default PumpCurveNew2; 