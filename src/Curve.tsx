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
  x: number;
  y: number;
  isEfficiency?: boolean;
  actualFlow?: number;
  actualHead?: number;
  actualEfficiency?: number;  // Add this line
}

interface BepPoint {
  flow: number;
  head: number;
  efficiency: number;
}

interface DefaultDataPoint {
  flow: number | string;
  head?: number | string;
  efficiency?: number | string;
}

interface CaseInfo {
  caseName: string;
    projectName: string;
    stage: string;
    date: string;
    pumpName: string;
}

interface LoadedData {
  caseInfo: CaseInfo;  // Change from optional to required and use CaseInfo interface
  maxValues?: {
    head?: number;
    flow?: number;
    efficiency?: number;
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
    flow: string;
    head: string;
    efficiency: string;
  };
}

interface HistoryState {
  points: Point[];
  efficiencyPoints: Point[];
  vfdPoints: Point[];
}

interface DraggedPoint {
  index: number;
  field: string;
  x: number;
  type: 'head' | 'efficiency' | 'vfd';
}

interface ComparisonData {
  points?: {
    headPoints?: DefaultDataPoint[];
    efficiencyPoints?: DefaultDataPoint[];
    vfdPoints?: DefaultDataPoint[];
  };
  maxValues?: {
    head?: number;
    flow?: number;
    efficiency?: number;
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
  const [caseInfo, setCaseInfo] = useState<CaseInfo>({  // Add type annotation
    caseName: '',
    projectName: '',
    stage: '수행',
    date: new Date().toISOString().split('T')[0],
    pumpName: ''
  });
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);
  const [imageOpacity, setImageOpacity] = useState(0.5);
  const [showManual, setShowManual] = useState(false);
  const [copyEffect, setCopyEffect] = useState<string>('');
  const [canvasKey, setCanvasKey] = useState<number>(0);
  const [recordMode, setRecordMode] = useState<'head' | 'efficiency' | 'vfd'>('head');
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState<number>(-1);
  const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null);
  const [maxRpm, setMaxRpm] = useState<number>(1800);

  // Add refs for previous range values
  const prevMaxFlowRef = useRef(maxFlow);
  const prevMaxHeadRef = useRef(maxHead);

  const sortedPoints = [...points].sort((a, b) => a.x - b.x);
  const sortedEfficiencyPoints = [...efficiencyPoints].sort((a, b) => a.x - b.x);
  const sortedVfdPoints = [...vfdPoints].sort((a, b) => a.x - b.x);

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

  const calculateActualPolynomialCoefficients = (points: Point[], degree: number, maxX: number, maxY: number) => {
    if (points.length < 2) return [];

    const actualPoints = points.map(point => ({
      x: (point.x * maxX) / 100,
      y: (point.y * maxY) / 100,
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

    const isEfficiencyPoints = points[0].isEfficiency;

    // Convert percentage points to actual values
    const actualPoints = points.map(point => ({
      x: point.actualFlow || (point.x * maxFlow) / 100,  // Use actual flow if available
      y: isEfficiencyPoints ? point.y : (point.actualHead || (point.y * maxHead) / 100),  // Keep efficiency as %, convert head to actual
      isEfficiency: point.isEfficiency
    }));

    // Draw points
    actualPoints.forEach(point => {
      // Convert actual values to canvas coordinates
      const x = padding.left + ((point.x / maxFlow) * drawingWidth);
      const y = padding.top + (1 - (point.y / (isEfficiencyPoints ? 100 : maxHead))) * drawingHeight;

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, isOpHead ? 6 : 4, 0, 2 * Math.PI);
      if (isOpHead) {
        // Draw white border
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Draw crosshair
        const crossSize = 8;
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.moveTo(x - crossSize, y);
        ctx.lineTo(x + crossSize, y);
        ctx.moveTo(x, y - crossSize);
        ctx.lineTo(x, y + crossSize);
        ctx.stroke();
      }
      ctx.fill();
    });

    // Only draw trendline if we have enough points and not opHead
    if (points.length <= degree || isOpHead) return;

    // Calculate polynomial coefficients using actual values
    const xValues = actualPoints.map(p => p.x);
    const yValues = actualPoints.map(p => p.y);
    const coefficients = calculatePolynomialCoefficients(xValues, yValues, degree);

    // Draw curve
    ctx.beginPath();
    ctx.strokeStyle = color;

    const maxFlowPoint = Math.max(...xValues);
    const stepSize = maxFlow / 200; // Increase number of points for smoother curve

    for (let flow = 0; flow <= maxFlowPoint; flow += stepSize) {
      const y = coefficients.reduce((acc, coeff, index) => acc + coeff * Math.pow(flow, index), 0);
      
      // Skip if y value is outside reasonable range
      if (isEfficiencyPoints && (y < 0 || y > 100)) continue;
      if (!isEfficiencyPoints && (y < 0 || y > maxHead * 1.2)) continue;

      // Convert to canvas coordinates
      const canvasX = padding.left + (flow / maxFlow) * drawingWidth;
      const canvasY = padding.top + (1 - (y / (isEfficiencyPoints ? 100 : maxHead))) * drawingHeight;
      
      if (flow === 0) {
        ctx.moveTo(canvasX, canvasY);
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
      const bepFlowPercent = (bep.flow / maxFlow) * 100;
      const bepHeadPercent = (bep.head / maxHead) * 100;

      // Draw BEP line (quadratic curve through origin and BEP)
      ctx.beginPath();
      ctx.strokeStyle = '#800080';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]); // Dashed line

      // Calculate quadratic curve through origin and BEP
      const a = bepHeadPercent / (bepFlowPercent * bepFlowPercent);
      
      // Calculate head polynomial coefficients for TDH curve
      const headCoefficients = calculatePolynomialCoefficients(points.map(p => p.x), points.map(p => p.y), headDegree);
      
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
      const headCoefficients = calculatePolynomialCoefficients(points.map(p => p.x), points.map(p => p.y), headDegree);

      // Second operating point curve (blue)
      const secondPoint = points[1];
      const secondPointX = (secondPoint.x * maxFlow) / 100;
      const secondPointY = (secondPoint.y * maxHead) / 100;
      const a1 = secondPointY / (secondPointX * secondPointX);

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
      const labelX1 = secondPoint.x * 0.7;
      const labelY1 = (a1 * (labelX1 * maxFlow / 100) * (labelX1 * maxFlow / 100) * 100) / maxHead;
      
      const labelCanvasX1 = padding.left + (labelX1) * drawingWidth / 100;
      const labelCanvasY1 = padding.top + (1 - labelY1 / 100) * drawingHeight - 10;

      ctx.save();
      ctx.fillStyle = '#0000FF';
      ctx.font = FONT_SIZES.mainValue;
      ctx.textAlign = 'center';
      ctx.fillText('Min Flow', labelCanvasX1, labelCanvasY1);
      ctx.restore();

      // Find point with maximum flow
      const maxFlowPoint = points.reduce((max, current) => 
        current.x > max.x ? current : max
      , points[0]);

      // Maximum flow point curve (blue)
      const maxFlowPointX = (maxFlowPoint.x * maxFlow) / 100;
      const maxFlowPointY = (maxFlowPoint.y * maxHead) / 100;
      const a2 = maxFlowPointY / (maxFlowPointX * maxFlowPointX);

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
      const labelX2 = maxFlowPoint.x * 0.7;
      const labelY2 = (a2 * (labelX2 * maxFlow / 100) * (labelX2 * maxFlow / 100) * 100) / maxHead;
      
      const labelCanvasX2 = padding.left + (labelX2) * drawingWidth / 100;
      const labelCanvasY2 = padding.top + (1 - labelY2 / 100) * drawingHeight - 10;

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
        const comparisonHeadPoints = comparisonData.points.headPoints.map(point => {
          const x = (Number(point.flow) * 100) / maxFlow;
          const y = (Number(point.head) * 100) / maxHead;
          return {
            x: Math.max(0, Math.min(100, x)),
            y: Math.max(0, Math.min(100, y))
          };
        }).filter(point => !isNaN(point.x) && !isNaN(point.y));

        if (comparisonHeadPoints.length > 0) {
          drawPolynomialTrendline(ctx, comparisonHeadPoints, headDegree, '#808080', padding, drawingWidth, drawingHeight);
        }
      }

      // Draw comparison efficiency points and curve
      if (comparisonData.points.efficiencyPoints && comparisonData.points.efficiencyPoints.length > 0) {
        const comparisonEffPoints = comparisonData.points.efficiencyPoints.map(point => {
          const x = (Number(point.flow) * 100) / maxFlow;
          const y = (Number(point.efficiency) * 100) / maxEfficiency;
          return {
            x: Math.max(0, Math.min(100, x)),
            y: Math.max(0, Math.min(100, y))
          };
        }).filter(point => !isNaN(point.x) && !isNaN(point.y));

        if (comparisonEffPoints.length > 0) {
          drawPolynomialTrendline(ctx, comparisonEffPoints, efficiencyDegree, '#808080', padding, drawingWidth, drawingHeight);
        }
      }

      // Draw comparison VFD points
      if (comparisonData.points.vfdPoints && comparisonData.points.vfdPoints.length > 0) {
        const comparisonVfdPoints = comparisonData.points.vfdPoints.map(point => {
          const x = (Number(point.flow) * 100) / maxFlow;
          const y = (Number(point.head) * 100) / maxHead;
          return {
            x: Math.max(0, Math.min(100, x)),
            y: Math.max(0, Math.min(100, y))
          };
        }).filter(point => !isNaN(point.x) && !isNaN(point.y));

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
      caseInfo.date
    ]
      .filter(Boolean) // Remove empty values
      .join('_');
    
    if (newCaseName !== caseInfo.caseName) {
      setCaseInfo(prev => ({ ...prev, caseName: newCaseName }));
    }
  }, [caseInfo.projectName, caseInfo.stage, caseInfo.pumpName, caseInfo.date]);

  const findClosestPoint = (x: number, y: number, points: Point[]) => {
    if (points.length === 0) return { index: -1, distance: Infinity };

    let minDistance = Infinity;
    let closestIndex = -1;

    points.forEach((point, index) => {
      const distance = Math.sqrt(
        Math.pow(point.x - x, 2) + 
        Math.pow(point.y - y, 2)
      );
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = index;
      }
    });

    return { index: closestIndex, distance: minDistance };
  };

  const calculateCanvasCoordinates = (
    clientX: number,
    clientY: number,
    canvas: HTMLCanvasElement
  ) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    // Calculate padding based on canvas dimensions
    const padding = {
      left: Math.round(canvas.width * 0.07),
      right: Math.round(canvas.width * 0.07),
      top: Math.round(canvas.height * 0.033),
      bottom: Math.round(canvas.height * 0.060)
    };

    const drawingWidth = canvas.width - padding.left - padding.right;
    const drawingHeight = canvas.height - padding.top - padding.bottom;

    // Calculate exact canvas coordinates
    const canvasX = (clientX - rect.left) * scaleX;
    const canvasY = (clientY - rect.top) * scaleY;

    // Convert to percentage values considering padding
    let x = ((canvasX - padding.left) / drawingWidth) * 100;
    let y = (1 - (canvasY - padding.top) / drawingHeight) * 100;

    // Clamp values between 0 and 100
    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));

    // Round to one decimal place
    return {
      x: parseFloat(x.toFixed(1)),
      y: parseFloat(y.toFixed(1))
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 2) {
      handleCanvasClick(e);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const { x, y } = calculateCanvasCoordinates(e.clientX, e.clientY, canvas);

    // Find the closest point
    const headResult = findClosestPoint(x, y, points);
    const efficiencyResult = findClosestPoint(x, y, efficiencyPoints);
    const vfdResult = findClosestPoint(x, y, vfdPoints);

    // Determine which point is closer
    if (headResult.distance < efficiencyResult.distance && headResult.distance < vfdResult.distance && headResult.distance < 5) {
      setIsDragging(true);
      setDraggedPoint({ index: headResult.index, field: 'x', x, type: 'head' });
      setDragMode('head');
    } else if (efficiencyResult.distance < vfdResult.distance && efficiencyResult.distance < 5) {
      setIsDragging(true);
      setDraggedPoint({ index: efficiencyResult.index, field: 'x', x, type: 'efficiency' });
      setDragMode('efficiency');
    } else if (vfdResult.distance < 5) {
      setIsDragging(true);
      setDraggedPoint({ index: vfdResult.index, field: 'x', x, type: 'vfd' });
      setDragMode('vfd');
    } else if (x >= 0 && x <= 100 && y >= 0 && y <= 100) {
      // If no point is close enough, add a new point
      handleCanvasClick(e);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !draggedPoint) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const { x, y } = calculateCanvasCoordinates(e.clientX, e.clientY, canvas);

    // Clamp values between 0 and 100
    const clampedX = Math.max(0, Math.min(100, x));
    const clampedY = Math.max(0, Math.min(100, y));

    let newPoints = [...points];
    let newEfficiencyPoints = [...efficiencyPoints];
    let newVfdPoints = [...vfdPoints];

    if (dragMode === 'head') {
      newPoints[draggedPoint.index] = { 
        x: parseFloat(clampedX.toFixed(1)), 
        y: parseFloat(clampedY.toFixed(1)) 
      };
      setPoints(newPoints);
    } else if (dragMode === 'efficiency') {
      newEfficiencyPoints[draggedPoint.index] = { 
        x: parseFloat(clampedX.toFixed(1)), 
        y: parseFloat(clampedY.toFixed(1)) 
      };
      setEfficiencyPoints(newEfficiencyPoints);
    } else if (dragMode === 'vfd') {
      newVfdPoints[draggedPoint.index] = { 
        x: parseFloat(clampedX.toFixed(1)), 
        y: parseFloat(clampedY.toFixed(1)) 
      };
      setVfdPoints(newVfdPoints);
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      // Save the final state to history only when dragging ends
      saveToHistory(points, efficiencyPoints, vfdPoints);
    }
    setIsDragging(false);
      setDraggedPoint(null);
    setDragMode(null);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { x, y } = calculateCanvasCoordinates(e.clientX, e.clientY, canvas);

    // Right click to delete the closest point
    if (e.button === 2) {
      e.preventDefault();
      const clickPoint = { x, y };
      
      let minDistance = Infinity;
      let closestPointIndex = -1;
      let pointType: 'head' | 'efficiency' | 'vfd' = 'head';

      // Check all points sets
      points.forEach((point, index) => {
        const distance = Math.sqrt(
          Math.pow(point.x - clickPoint.x, 2) + 
          Math.pow(point.y - clickPoint.y, 2)
        );
        if (distance < minDistance) {
          minDistance = distance;
          closestPointIndex = index;
          pointType = 'head';
        }
      });

      efficiencyPoints.forEach((point, index) => {
        const distance = Math.sqrt(
          Math.pow(point.x - clickPoint.x, 2) + 
          Math.pow(point.y - clickPoint.y, 2)
        );
        if (distance < minDistance) {
          minDistance = distance;
          closestPointIndex = index;
          pointType = 'efficiency';
        }
      });

      vfdPoints.forEach((point, index) => {
        const distance = Math.sqrt(
          Math.pow(point.x - clickPoint.x, 2) + 
          Math.pow(point.y - clickPoint.y, 2)
        );
        if (distance < minDistance) {
          minDistance = distance;
          closestPointIndex = index;
          pointType = 'vfd';
        }
      });

      if (minDistance < 5) {
        handleDeletePoint(closestPointIndex, pointType);
      }
      return;
    }

    // Left click to add new point
    if (x >= 0 && x <= 100 && y >= 0 && y <= 100) {
      const newPoint = { x: parseFloat(x.toFixed(1)), y: parseFloat(y.toFixed(1)) };

      let newPoints = [...points];
      let newEfficiencyPoints = [...efficiencyPoints];
      let newVfdPoints = [...vfdPoints];

      if (recordMode === 'head') {
        newPoints = [...points, newPoint];
        setPoints(newPoints);
      } else if (recordMode === 'efficiency') {
        newEfficiencyPoints = [...efficiencyPoints, newPoint];
        setEfficiencyPoints(newEfficiencyPoints);
      } else if (recordMode === 'vfd') {
        newVfdPoints = [...vfdPoints, newPoint];
        setVfdPoints(newVfdPoints);
      }

      saveToHistory(newPoints, newEfficiencyPoints, newVfdPoints);
    }
  };

  const handleEditPoint = (index: number, type: 'head' | 'efficiency' | 'vfd', newX: number, newY: number) => {
    let newPoints = [...points];
    let newEfficiencyPoints = [...efficiencyPoints];
    let newVfdPoints = [...vfdPoints];

    // Store actual values directly
    if (type === 'head') {
      // Convert to percentage for canvas display
      const xPercentage = (newX * 100) / maxFlow;
      const yPercentage = (newY * 100) / maxHead;
      newPoints[index] = { 
        x: xPercentage, 
        y: yPercentage,
        actualFlow: newX,  // Store actual flow
        actualHead: newY   // Store actual head
      };
      setPoints(newPoints);
    } else if (type === 'efficiency') {
      const xPercentage = (newX * 100) / maxFlow;
      newEfficiencyPoints[index] = { 
        x: xPercentage, 
        y: newY,  // Efficiency is always in percentage
        isEfficiency: true,
        actualFlow: newX,   // Store actual flow
        actualEfficiency: newY  // Store actual efficiency percentage
      };
      setEfficiencyPoints(newEfficiencyPoints);
    } else if (type === 'vfd') {
      const xPercentage = (newX * 100) / maxFlow;
      const yPercentage = (newY * 100) / maxHead;
      newVfdPoints[index] = { 
        x: xPercentage, 
        y: yPercentage,
        actualFlow: newX,  // Store actual flow
        actualHead: newY   // Store actual head
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
      flow: ((point.x * maxFlow) / 100).toFixed(1),
      head: ((point.y * maxHead) / 100).toFixed(1)
    }));

    const efficiencyData = sortedEfficiencyPoints.map((point, index) => ({
      no: index + 1,
      flow: ((point.x * maxFlow) / 100).toFixed(1),
      efficiency: ((point.y * maxEfficiency) / 100).toFixed(1)
    }));

    const vfdData = sortedVfdPoints.map((point, index) => {
      const { speedRatio, vfdEfficiency } = calculateVfdEfficiency(point);
      return {
        no: index + 1,
        flow: ((point.x * maxFlow) / 100).toFixed(1),
        head: ((point.y * maxHead) / 100).toFixed(1),
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
    const headCoefficients = calculateActualPolynomialCoefficients(points, headDegree, maxFlow, maxHead);
    const efficiencyCoefficients = calculateActualPolynomialCoefficients(efficiencyPoints, efficiencyDegree, maxFlow, maxEfficiency);

    // Find BEP point
    const bep = findBepPoint(points, efficiencyPoints);

    const data: LoadedData = {
      caseInfo,
      maxValues: {
        head: maxHead,
        flow: maxFlow,
        efficiency: maxEfficiency,
        rpm: maxRpm  // Add this line
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
          flow: ((point.x * maxFlow) / 100).toFixed(1),
          head: ((point.y * maxHead) / 100).toFixed(1)
        })),
        efficiencyPoints: sortedEfficiencyPoints.map(point => ({
          flow: ((point.x * maxFlow) / 100).toFixed(1),
          efficiency: point.y.toFixed(1)
        })),
        vfdPoints: sortedVfdPoints.map(point => {
          const { speedRatio, vfdEfficiency } = calculateVfdEfficiency(point);
          return {
            flow: ((point.x * maxFlow) / 100).toFixed(1),
            head: ((point.y * maxHead) / 100).toFixed(1),
            speed: speedRatio.toFixed(1),
            efficiency: vfdEfficiency.toFixed(1)
          };
        })
      },
      bepPoint: bep ? {
        flow: bep.flow.toFixed(1),
        head: bep.head.toFixed(1),
        efficiency: bep.efficiency.toFixed(1)
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
        head: Number(data.maxValues?.head) || 100,
        flow: Number(data.maxValues?.flow) || 100,
        efficiency: Number(data.maxValues?.efficiency) || 100,
        rpm: Number(data.maxValues?.rpm) || 1800
      };

      const newCaseInfo = {
        caseName: data.caseInfo?.caseName || '',
        projectName: data.caseInfo?.projectName || '',
        stage: data.caseInfo?.stage || '수행',
        date: data.caseInfo?.date || new Date().toISOString().split('T')[0],
        pumpName: data.caseInfo?.pumpName || ''
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
        data.points.headPoints.forEach((point: DefaultDataPoint) => {
          const flow = Number(point.flow);
          const head = Number(point.head);
          if (!isNaN(flow) && !isNaN(head)) {
            newPoints.push({
              x: (flow * 100) / newMaxValues.flow,
              y: (head * 100) / newMaxValues.head,
              actualFlow: flow,
              actualHead: head
            });
          }
        });
      }

      if (Array.isArray(data.points?.efficiencyPoints)) {
        data.points.efficiencyPoints.forEach((point: DefaultDataPoint) => {
          const flow = Number(point.flow);
          const efficiency = Number(point.efficiency);
          if (!isNaN(flow) && !isNaN(efficiency)) {
            newEfficiencyPoints.push({
              x: (flow * 100) / newMaxValues.flow,
              y: efficiency,
              isEfficiency: true,
              actualFlow: flow,
              actualEfficiency: efficiency
            });
          }
        });
      }

      if (Array.isArray(data.points?.vfdPoints)) {
        data.points.vfdPoints.forEach((point: DefaultDataPoint) => {
          const flow = Number(point.flow);
          const head = Number(point.head);
          if (!isNaN(flow) && !isNaN(head)) {
            newVfdPoints.push({
              x: (flow * 100) / newMaxValues.flow,
              y: (head * 100) / newMaxValues.head,
              actualFlow: flow,
              actualHead: head
            });
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
        setMaxHead(newMaxValues.head);
        setMaxFlow(newMaxValues.flow);
        setMaxEfficiency(newMaxValues.efficiency);
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
            pumpName: data.caseInfo.pumpName || ''
          });
        }

        // Set max values
        if (data.maxValues && typeof data.maxValues === 'object') {
          const { head = 100, flow = 100, efficiency = 100, rpm = 1800 } = data.maxValues;
          setMaxHead(Number(head) || 100);
          setMaxFlow(Number(flow) || 100);
          setMaxEfficiency(Number(efficiency) || 100);
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
        const validatePoint = (point: { 
          flow: string | number; 
          head?: string | number; 
          efficiency?: string | number;
        }): Point | null => {
          if (!point || typeof point !== 'object') return null;
          const flow = Number(point.flow);
          const head = Number(point.head);
          const efficiency = Number(point.efficiency);
          
          if (isNaN(flow)) return null;
          if (isNaN(head) && isNaN(efficiency)) return null;
          
          return {
            x: (flow * 100) / (data.maxValues?.flow || 100),
            y: head ? (head * 100) / (data.maxValues?.head || 100) : 
               efficiency ? efficiency : 0
          };
        };

        // Convert and set points
        const headPoints: Point[] = [];
        const efficiencyPoints: Point[] = [];
        const vfdPoints: Point[] = [];

        if (Array.isArray(data.points?.headPoints)) {
          data.points.headPoints.forEach((point: DefaultDataPoint) => {
            const validPoint = validatePoint(point);
            if (validPoint) headPoints.push(validPoint);
          });
        }

        if (Array.isArray(data.points?.efficiencyPoints)) {
          data.points.efficiencyPoints.forEach((point: DefaultDataPoint) => {
            const validPoint = validatePoint(point);
            if (validPoint) efficiencyPoints.push(validPoint);
          });
        }

        if (Array.isArray(data.points?.vfdPoints)) {
          data.points.vfdPoints.forEach((point: DefaultDataPoint) => {
            const validPoint = validatePoint(point);
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
    const headCoefficients = calculateActualPolynomialCoefficients(points, headDegree, maxFlow, maxHead);
    const efficiencyCoefficients = calculateActualPolynomialCoefficients(efficiencyPoints, efficiencyDegree, maxFlow, maxEfficiency);
    
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
  }, [points, efficiencyPoints, headDegree, efficiencyDegree, maxFlow, maxHead, maxEfficiency]);

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

  // Add keyboard shortcut handler
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
          setRecordMode(prev => {
            const newMode = prev === 'head' ? 'efficiency' : prev === 'efficiency' ? 'vfd' : 'head';
            setSelectedMode(newMode);
            return newMode;
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

  // Function to calculate VFD efficiency using affinity law
  const calculateVfdEfficiency = (vfdPoint: Point): { speedRatio: number; vfdEfficiency: number } => {
    if (points.length < 2 || efficiencyPoints.length < 2) return { speedRatio: 0, vfdEfficiency: 0 };

    // Get actual values
    const vfdFlow = (vfdPoint.x * maxFlow) / 100;
    const vfdHead = (vfdPoint.y * maxHead) / 100;

    // Calculate head polynomial coefficients for 100% speed curve
    const headCoefficients = calculateActualPolynomialCoefficients(points, headDegree, maxFlow, maxHead);
    if (!headCoefficients.length) return { speedRatio: 0, vfdEfficiency: 0 };

    // Calculate base head at VFD flow point from 100% speed curve
    const baseHead = headCoefficients.reduce((sum, coeff, index) => {
      return sum + coeff * Math.pow(vfdFlow, headCoefficients.length - 1 - index);
    }, 0);

    // Calculate speed ratio using affinity law: H2/H1 = (N2/N1)^2
    const speedRatio = Math.sqrt(Math.max(0.1, vfdHead / Math.max(0.1, baseHead)));

    // Calculate quadratic coefficient for VFD point curve (y = ax²)
    const a = vfdHead / Math.max(0.0001, vfdFlow * vfdFlow);

    // Find intersection point with head curve using more robust method
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
    const efficiencyCoefficients = calculateActualPolynomialCoefficients(
      efficiencyPoints,
      efficiencyDegree,
      maxFlow,
      maxEfficiency
    );
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

  // Add function to find BEP
  const findBepPoint = (points: Point[], efficiencyPoints: Point[]): BepPoint | null => {
    if (efficiencyPoints.length < 2) return null;

    // Calculate efficiency polynomial coefficients
    const efficiencyCoefficients = calculateActualPolynomialCoefficients(
      efficiencyPoints,
      efficiencyDegree,
      maxFlow,
      maxEfficiency
    );

    if (!efficiencyCoefficients.length) return null;

    // Find maximum efficiency point by sampling points
    let maxEff = -Infinity;
    let bepFlow = 0;
    
    // Sample 1000 points to find maximum
    const numSamples = 1000;
    const maxFlowPoint = Math.max(...efficiencyPoints.map(p => (p.x * maxFlow) / 100));
    
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
    const headCoefficients = calculateActualPolynomialCoefficients(points, headDegree, maxFlow, maxHead);
    if (!headCoefficients.length) return null;

    const bepHead = headCoefficients.reduce((sum, coeff, index) => {
      return sum + coeff * Math.pow(bepFlow, headCoefficients.length - 1 - index);
    }, 0);

    return {
      flow: bepFlow,
      head: bepHead,
      efficiency: maxEff
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
                flow: Number(point.flow),
                head: Number(point.head)
              }));
            }
            
            // Transform efficiency points
            if (data.points.efficiencyPoints) {
              data.points.efficiencyPoints = data.points.efficiencyPoints.map((point: DefaultDataPoint) => ({
                flow: Number(point.flow),
                efficiency: Number(point.efficiency)
              }));
            }
            
            // Transform VFD points
            if (data.points.vfdPoints) {
              data.points.vfdPoints = data.points.vfdPoints.map((point: DefaultDataPoint) => ({
                flow: Number(point.flow),
                head: Number(point.head)
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
    // Store current values as previous before updating
    const prevMaxFlow = prevMaxFlowRef.current;
    const prevMaxHead = prevMaxHeadRef.current;
    
    // Only update canvas positions when range changes, keeping actual values intact
    const newPoints = points.map(point => ({
      ...point,
      x: (point.actualFlow || (point.x * prevMaxFlow / 100)) * 100 / maxFlow,
      y: (point.actualHead || (point.y * prevMaxHead / 100)) * 100 / maxHead
    }));
    setPoints(newPoints);

    const newEfficiencyPoints = efficiencyPoints.map(point => ({
      ...point,
      x: (point.actualFlow || (point.x * prevMaxFlow / 100)) * 100 / maxFlow,
      y: point.actualEfficiency || point.y,  // Keep efficiency percentage as is
      isEfficiency: true,
      actualFlow: point.actualFlow || (point.x * prevMaxFlow / 100),
      actualEfficiency: point.actualEfficiency || point.y
    }));
    setEfficiencyPoints(newEfficiencyPoints);

    const newVfdPoints = vfdPoints.map(point => ({
      ...point,
      x: (point.actualFlow || (point.x * prevMaxFlow / 100)) * 100 / maxFlow,
      y: (point.actualHead || (point.y * prevMaxHead / 100)) * 100 / maxHead
    }));
    setVfdPoints(newVfdPoints);

    // Update refs with current values
    prevMaxFlowRef.current = maxFlow;
    prevMaxHeadRef.current = maxHead;
  }, [maxFlow, maxHead, maxEfficiency, points, efficiencyPoints, vfdPoints]);

  return (
    <Card className="max-w-[1800px] mx-auto">
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
                  Load Main Case
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
                Clear Main
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
                <Button variant="outline" size="sm" onClick={() => setShowManual(true)}>
                  <FileText className="w-4 h-4 mr-2" />
                  Manual
                </Button>
                {/* Other buttons */}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-between items-center bg-gray-300">
            <div className="flex flex-wrap gap-2 flex-grow">
              <div className="flex items-center gap-2 min-w-[150px]">
                <Label htmlFor="projectName" className="text-xs whitespace-nowrap">PJT:</Label>
                <Input
                  id="projectName"
                  value={caseInfo.projectName}
                  onChange={(e) => setCaseInfo(prev => ({ ...prev, projectName: e.target.value }))}
                  className="flex-1 bg-white h-8 min-w-[100px] text-xs"
                />
              </div>
              <div className="flex items-center gap-2 min-w-[150px]">
                <Label htmlFor="stage" className="text-xs whitespace-nowrap">단계:</Label>
                <select
                  id="stage"
                  title="단계 선택"
                  value={caseInfo.stage}
                  onChange={(e) => setCaseInfo(prev => ({ ...prev, stage: e.target.value }))}
                  className="flex-1 text-xs rounded-md border border-input bg-background px-3 py-2 h-8.5 min-w-[100px] bg-white"
                >
                  <option value="수행">수행</option>
                  <option value="견적">견적</option>
                  <option value="기타">기타</option>
                </select>
              </div>
              <div className="flex items-center gap-2 min-w-[150px]">
                <Label htmlFor="date" className="text-xs whitespace-nowrap">Date:</Label>
                <Input
                  id="date"
                  type="date"
                  value={caseInfo.date}
                  onChange={(e) => setCaseInfo(prev => ({ ...prev, date: e.target.value }))}
                  className="flex-1 bg-white h-9 min-w-[120px] text-xs"
                />
              </div>
              <div className="flex items-center gap-2 min-w-[150px]">
                <Label htmlFor="pumpName" className="text-xs whitespace-nowrap">Pump Name:</Label>
                <Input
                  id="pumpName"
                  value={caseInfo.pumpName}
                  onChange={(e) => setCaseInfo(prev => ({ ...prev, pumpName: e.target.value }))}
                  className="flex-1 bg-white h-9 min-w-[100px] text-xs"
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
                value={maxHead}
                onChange={(e) => setMaxHead(parseFloat(e.target.value) || 100)}
                className="w-24 h-8 bg-white text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="maxFlow" className="text-xs">Flow Range:</Label>
              <Input
                id="maxFlow"
                type="number"
                value={maxFlow}
                onChange={(e) => setMaxFlow(parseFloat(e.target.value) || 100)}
                className="w-24 h-8 bg-white text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="maxEfficiency" className="text-xs">Eff. Range:</Label>
              <Input
                id="maxEfficiency"
                type="number"
                value={maxEfficiency}
                onChange={(e) => setMaxEfficiency(parseFloat(e.target.value) || 100)}
                className="w-24 h-8 bg-white text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="maxRpm" className="text-xs">RPM(100%):</Label>
              <Input
                id="maxRpm"
                type="number"
                value={maxRpm}
                onChange={(e) => setMaxRpm(parseFloat(e.target.value) || 1800)}
                className="w-24 h-8 bg-white text-xs"
              />
            </div>
            <div className="flex items-center gap-4">
              <Label className="font-medium text-xs">Record mode:</Label>
              <div className="flex items-center bg-white rounded-lg border border-gray-200">
                <button
                  onClick={() => {
                    setSelectedMode('head');
                    setRecordMode('head');
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
                    setRecordMode('efficiency');
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
                    setRecordMode('vfd');
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
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onContextMenu={handleCanvasClick}
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="max-w-[800px] rounded-lg">
                  <h3 className="text-xs text-blue-600 font-semibold">Performance Curve Points</h3>
              <table className="w-full border-collapse table-fixed bg-white">
                <colgroup>
                  <col className="w-[7%]" />
                  <col className="w-[15%]" />
                  <col className="w-[15%]" />
                  <col className="w-[10%]" />
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
                          value={point.actualFlow?.toFixed(1) || ((point.x * maxFlow) / 100).toFixed(1)}
                          onChange={(e) => handleEditPoint(index, 'head', (parseFloat(e.target.value) * 100) / maxFlow, point.y)}
                          className="w-14 h-6"
                          title={`Edit flow for head point ${index + 1}`}
                          placeholder="Flow"
                        />
                      </td>
                      <td className="border p-1 text-left">
                        <input
                            type="number"
                          value={point.actualHead?.toFixed(1) || ((point.y * maxHead) / 100).toFixed(1)}
                          onChange={(e) => handleEditPoint(index, 'head', point.x, (parseFloat(e.target.value) * 100) / maxHead)}
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
                  <col className="w-[7%]" />
                  <col className="w-[15%]" />
                  <col className="w-[15%]" />
                  <col className="w-[10%]" />
                </colgroup>
                <thead>
                  <tr>
                    <th className="border p-1 text-left">No</th>
                    <th className="border p-1 text-left">Flow(m³/h)</th>
                    <th className="border p-1 text-left">Efficiency(%)</th>
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
                          value={point.actualFlow?.toFixed(1) || ((point.x * maxFlow) / 100).toFixed(1)}
                          onChange={(e) => handleEditPoint(index, 'efficiency', (parseFloat(e.target.value) * 100) / maxFlow, point.y)}
                          className="w-14 h-6"
                          title={`Edit flow for efficiency point ${index + 1}`}
                          placeholder="Flow"
                        />
                      </td>
                      <td className="border p-1 text-left">
                        <input
                          type="number"
                          value={point.y.toFixed(1)}
                          onChange={(e) => handleEditPoint(index, 'efficiency', point.x, parseFloat(e.target.value))}
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

            <div className="max-w-[800px] rounded-lg">
              <h3 className="text-xs text-green-700 font-semibold">Operating Points</h3>
              <table className="w-full border-collapse table-fixed bg-white">
                <colgroup>
                  <col className="w-[5%]" />
                  <col className="w-[15%]" />
                  <col className="w-[12%]" />
                  <col className="w-[10%]" />
                  <col className="w-[12%]" />
                  <col className="w-[12%]" />
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
                            value={point.actualFlow?.toFixed(1) || ((point.x * maxFlow) / 100).toFixed(1)}
                            onChange={(e) => handleEditPoint(index, 'vfd', (parseFloat(e.target.value) * 100) / maxFlow, point.y)}
                            className="w-14 h-6"
                            title={`Edit flow for VFD point ${index + 1}`}
                            placeholder="Flow"
                          />
                        </td>
                        <td className="border p-1 text-left">
                          <input
                            type="number"
                            value={point.actualHead?.toFixed(1) || ((point.y * maxHead) / 100).toFixed(1)}
                            onChange={(e) => handleEditPoint(index, 'vfd', point.x, (parseFloat(e.target.value) * 100) / maxHead)}
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