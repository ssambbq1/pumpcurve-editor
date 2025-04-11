'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Copy, Table, Download, Upload, FileUp, Image as ImageIcon, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Point {
  x: number;
  y: number;
}

interface DefaultDataPoint {
  flow: string;
  head?: string;
  efficiency?: string;
}

interface DefaultData {
  caseInfo: {
  caseName: string;
    projectName: string;
    stage: string;
    date: string;
    pumpName: string;
  };
  maxValues: {
    head: number;
    flow: number;
    efficiency: number;
  };
  equations: {
    head: {
      degree: number;
      equation: string;
    };
    efficiency: {
      degree: number;
      equation: string;
    };
  };
  points: {
    headPoints: DefaultDataPoint[];
    efficiencyPoints: DefaultDataPoint[];
  };
}

const PumpCurveNew2: React.FC = () => {
  const [points, setPoints] = useState<Point[]>([]);
  const [efficiencyPoints, setEfficiencyPoints] = useState<Point[]>([]);
  const [selectedMode, setSelectedMode] = useState<'head' | 'efficiency'>('head');
  const [headDegree, setHeadDegree] = useState(2);
  const [efficiencyDegree, setEfficiencyDegree] = useState(2);
  const [maxHead, setMaxHead] = useState<number>(100);
  const [maxFlow, setMaxFlow] = useState<number>(100);
  const [maxEfficiency, setMaxEfficiency] = useState<number>(100);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedPoint, setDraggedPoint] = useState<{
    index: number;
    field: 'x' | 'y';
    x: number;
    type: 'head' | 'efficiency';
  } | null>(null);
  const [dragMode, setDragMode] = useState<'head' | 'efficiency' | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [headEquation, setHeadEquation] = useState<string>('');
  const [efficiencyEquation, setEfficiencyEquation] = useState<string>('');
  const [caseInfo, setCaseInfo] = useState({
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

  const sortedPoints = [...points].sort((a, b) => a.x - b.x);
  const sortedEfficiencyPoints = [...efficiencyPoints].sort((a, b) => a.x - b.x);

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
    drawingHeight: number
  ) => {
    // Always draw points regardless of count
    points.forEach(point => {
      const x = padding.left + (point.x / 100) * drawingWidth;
      const y = padding.top + (1 - point.y / 100) * drawingHeight;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fill();
    });

    // Only draw trendline if we have enough points
    if (points.length <= degree) return;

    const xValues = points.map(p => p.x);
    const yValues = points.map(p => p.y);
    const coefficients = calculatePolynomialCoefficients(xValues, yValues, degree);

    ctx.beginPath();
    ctx.strokeStyle = color;

    const maxFlow = Math.max(...xValues);

    for (let x = 0; x <= maxFlow; x += 1) {
      const y = coefficients.reduce((acc, coeff, index) => acc + coeff * Math.pow(x, index), 0);
      const canvasX = padding.left + (x / 100) * drawingWidth;
      const canvasY = padding.top + (1 - y / 100) * drawingHeight;
      
      if (x === 0) {
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
      const maxHeight = 1000;

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
  }, [points, efficiencyPoints, maxFlow, maxHead, maxEfficiency, backgroundImage, imageOpacity]);

  // Separate drawing logic into its own function
  const drawCanvas = (
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number
  ) => {
    // Define padding
    const padding = {
      left: Math.round(canvasWidth * 0.067),
      right: Math.round(canvasWidth * 0.125),
      top: Math.round(canvasHeight * 0.033),
      bottom: Math.round(canvasHeight * 0.067)
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
      mainValue: `${Math.max(12, Math.min(20, canvasWidth * 0.013))}px Arial`,
      subValue: `${Math.max(10, Math.min(16, canvasWidth * 0.011))}px Arial`
    };

    // Draw grid
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = Math.max(0.5, canvasWidth * 0.0004);

    // Vertical grid lines with actual flow values
    for (let i = 0; i <= 10; i++) {
      const x = padding.left + (drawingWidth / 10) * i;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, canvasHeight - padding.bottom);
      ctx.stroke();

      // Draw actual flow values
      const actualFlow = ((i * 10) * maxFlow / 100).toFixed(0);
      ctx.fillStyle = '#000';
      ctx.font = FONT_SIZES.mainValue;
      ctx.textAlign = 'center';
      ctx.fillText(actualFlow, x, canvasHeight - padding.bottom / 2);

      // Draw intermediate values
      if (i < 10) {
        const xMid = x + (drawingWidth / 10) / 2;
        const actualFlowMid = ((i * 10 + 5) * maxFlow / 100).toFixed(0);
        ctx.font = FONT_SIZES.subValue;
        ctx.fillText(actualFlowMid, xMid, canvasHeight - padding.bottom / 2);
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
      const actualHead = ((percentage * maxHead) / 100).toFixed(1);
      const actualEfficiency = ((percentage * maxEfficiency) / 100).toFixed(1);

      // Draw Head values on the left
      ctx.fillStyle = '#0000FF';
      ctx.font = FONT_SIZES.mainValue;
      ctx.textAlign = 'right';
      ctx.fillText(actualHead, padding.left - 10, y + 5);

      // Draw Efficiency values on the right
      ctx.fillStyle = '#FF0000';
      ctx.textAlign = 'left';
      ctx.fillText(actualEfficiency, canvasWidth - padding.right + 10, y + 5);
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

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 2) {
      handleCanvasClick(e);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const padding = {
      left: Math.round(canvas.width * 0.067),    // ~80px at 1200px width
      right: Math.round(canvas.width * 0.125),   // ~150px at 1200px width
      top: Math.round(canvas.height * 0.033),     // ~40px at 1200px width
      bottom: Math.round(canvas.height * 0.067)   // ~80px at 1200px width
    };

    const rect = canvas.getBoundingClientRect();
    const drawingWidth = canvas.width - padding.left - padding.right;
    const drawingHeight = canvas.height - padding.top - padding.bottom;

    const x = ((e.clientX - rect.left - padding.left) / drawingWidth) * 100;
    const y = (1 - (e.clientY - rect.top - padding.top) / drawingHeight) * 100;

    // Find the closest point
    const headResult = findClosestPoint(x, y, points);
    const efficiencyResult = findClosestPoint(x, y, efficiencyPoints);

    // Determine which point is closer
    if (headResult.distance < efficiencyResult.distance && headResult.distance < 5) {
      setIsDragging(true);
      setDraggedPoint({ index: headResult.index, field: 'x', x, type: 'head' });
      setDragMode('head');
    } else if (efficiencyResult.distance < 5) {
      setIsDragging(true);
      setDraggedPoint({ index: efficiencyResult.index, field: 'x', x, type: 'efficiency' });
      setDragMode('efficiency');
    } else if (x >= 0 && x <= 100 && y >= 0 && y <= 100) {
      // If no point is close enough, add a new point
      handleCanvasClick(e);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !draggedPoint) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const padding = {
      left: Math.round(canvas.width * 0.067),    // ~80px at 1200px width
      right: Math.round(canvas.width * 0.125),   // ~150px at 1200px width
      top: Math.round(canvas.height * 0.033),     // ~40px at 1200px width
      bottom: Math.round(canvas.height * 0.067)   // ~80px at 1200px width
    };

    const rect = canvas.getBoundingClientRect();
    const drawingWidth = canvas.width - padding.left - padding.right;
    const drawingHeight = canvas.height - padding.top - padding.bottom;

    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left - padding.left) / drawingWidth) * 100));
    const y = Math.max(0, Math.min(100, (1 - (e.clientY - rect.top - padding.top) / drawingHeight) * 100));

    if (dragMode === 'head') {
      const newPoints = [...points];
      newPoints[draggedPoint.index] = { 
        x: parseFloat(x.toFixed(1)), 
        y: parseFloat(y.toFixed(1)) 
      };
      setPoints(newPoints);
    } else {
      const newPoints = [...efficiencyPoints];
      newPoints[draggedPoint.index] = { 
        x: parseFloat(x.toFixed(1)), 
        y: parseFloat(y.toFixed(1)) 
      };
      setEfficiencyPoints(newPoints);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
      setDraggedPoint(null);
    setDragMode(null);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const padding = {
      left: Math.round(canvas.width * 0.067),    // ~80px at 1200px width
      right: Math.round(canvas.width * 0.125),   // ~150px at 1200px width
      top: Math.round(canvas.height * 0.033),     // ~40px at 1200px width
      bottom: Math.round(canvas.height * 0.067)   // ~80px at 1200px width
    };

    const rect = canvas.getBoundingClientRect();
    const drawingWidth = canvas.width - padding.left - padding.right;
    const drawingHeight = canvas.height - padding.top - padding.bottom;

    const x = ((e.clientX - rect.left - padding.left) / drawingWidth) * 100;
    const y = (1 - (e.clientY - rect.top - padding.top) / drawingHeight) * 100;

    // Right click to delete the closest point
    if (e.button === 2) {
      e.preventDefault();
      const clickPoint = { x, y };
      const currentPoints = selectedMode === 'head' ? points : efficiencyPoints;
      
      if (currentPoints.length === 0) return;

      // Find the closest point
      let minDistance = Infinity;
      let closestPointIndex = -1;

      currentPoints.forEach((point, index) => {
        const distance = Math.sqrt(
          Math.pow(point.x - clickPoint.x, 2) + 
          Math.pow(point.y - clickPoint.y, 2)
        );
        if (distance < minDistance) {
          minDistance = distance;
          closestPointIndex = index;
        }
      });

      // Delete the closest point if it's within a reasonable distance
      if (minDistance < 5) {
        handleDeletePoint(closestPointIndex, selectedMode);
      }
      return;
    }

    // Left click to add new point (only if within drawing area)
    if (x >= 0 && x <= 100 && y >= 0 && y <= 100) {
      const newPoint = { x: parseFloat(x.toFixed(1)), y: parseFloat(y.toFixed(1)) };

      if (selectedMode === 'head') {
        setPoints(prev => [...prev, newPoint]);
      } else {
        setEfficiencyPoints(prev => [...prev, newPoint]);
      }
    }
  };

  const handleEditPoint = (index: number, type: 'head' | 'efficiency', newX: number, newY: number) => {
    if (type === 'head') {
      const newPoints = [...points];
      newPoints[index] = { x: newX, y: newY };
      setPoints(newPoints);
    } else {
      const newPoints = [...efficiencyPoints];
      newPoints[index] = { x: newX, y: newY };
      setEfficiencyPoints(newPoints);
    }
  };

  const handleDeletePoint = (index: number, type: 'head' | 'efficiency') => {
    if (type === 'head') {
      setPoints(prev => prev.filter((_, i) => i !== index));
    } else {
      setEfficiencyPoints(prev => prev.filter((_, i) => i !== index));
    }
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

    navigator.clipboard.writeText(tableText);
  };

  const handleExportJson = () => {
    const data = {
      caseInfo: {
        caseName: caseInfo.caseName,
        projectName: caseInfo.projectName,
        stage: caseInfo.stage,
        date: caseInfo.date,
        pumpName: caseInfo.pumpName
      },
      maxValues: {
        head: maxHead,
        flow: maxFlow,
        efficiency: maxEfficiency
      },
      equations: {
        head: {
          degree: headDegree,
          equation: headEquation
        },
        efficiency: {
          degree: efficiencyDegree,
          equation: efficiencyEquation
        }
      },
      points: {
        headPoints: sortedPoints.map(point => ({
          flow: ((point.x * maxFlow) / 100).toFixed(1),
          head: ((point.y * maxHead) / 100).toFixed(1)
        })),
        efficiencyPoints: sortedEfficiencyPoints.map(point => ({
          flow: ((point.x * maxFlow) / 100).toFixed(1),
          efficiency: ((point.y * maxEfficiency) / 100).toFixed(1)
        }))
      }
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

  const loadJsonFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result;
        if (typeof content !== 'string') return;
        
        const data: DefaultData = JSON.parse(content);
        
        // Update case info
        setCaseInfo(data.caseInfo);
        
        // Update max values
        setMaxHead(data.maxValues.head);
        setMaxFlow(data.maxValues.flow);
        setMaxEfficiency(data.maxValues.efficiency);
        
        // Update degrees if available
        if (data.equations?.head?.degree) {
          setHeadDegree(data.equations.head.degree);
        }
        if (data.equations?.efficiency?.degree) {
          setEfficiencyDegree(data.equations.efficiency.degree);
        }
        
        // Update points
        const headPoints = data.points.headPoints.map(point => ({
          x: (parseFloat(point.flow) * 100) / data.maxValues.flow,
          y: (parseFloat(point.head!) * 100) / data.maxValues.head
        }));
        setPoints(headPoints);
        
        const efficiencyPoints = data.points.efficiencyPoints.map(point => ({
          x: (parseFloat(point.flow) * 100) / data.maxValues.flow,
          y: (parseFloat(point.efficiency!) * 100) / data.maxValues.efficiency
        }));
        setEfficiencyPoints(efficiencyPoints);
      } catch (error) {
        console.error('Error loading JSON file:', error);
        alert('Invalid JSON file format');
      }
    };
    reader.readAsText(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/json") {
      loadJsonFile(file);
    } else {
      alert('Please select a JSON file');
    }
  };

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
  }, [points, efficiencyPoints, headDegree, efficiencyDegree, maxFlow, maxHead, maxEfficiency]);

  return (
    <Card>
      <CardContent className="p-10 bg-gray-300">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-2xl font-bold">PUMP CURVE EDITOR - version 0.1.1(beta)</h1>
            <div className="flex items-center gap-2">
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
                  className="flex items-center gap-2 h-10"
                >
                  <FileUp className="h-4 w-4" />
                  Load JSON
                </Button>
              </div>
              <Button
              variant="outline"
                size="sm"
                onClick={() => setShowManual(true)}
                className="flex items-center gap-2 h-10"
                title="Show Manual"
              >
                <FileText className="h-4 w-4" />
                Manual
              </Button>
            </div>
          </div>

          <Dialog open={showManual} onOpenChange={setShowManual}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>PUMP CURVE EDITOR 사용방법.</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">1. 기본 정보 입력</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>PJT, 단계, Date, Pump Name을 입력하면 자동으로 Case 명이 생성됩니다.</li>
                    <li>Load Default 또는 Load JSON 버튼을 통해 기존 데이터를 불러올 수 있습니다.</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">2. 그래프 범위 설정</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>TDH Range: Head 값의 최대 범위를 설정합니다.</li>
                    <li>Flow Range: Flow 값의 최대 범위를 설정합니다.</li>
                    <li>Eff. Range: Efficiency 값의 최대 범위를 설정합니다.</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">3. 포인트 입력 방법</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Record mode에서 Head 또는 Efficiency를 선택합니다.</li>
                    <li>그래프 영역을 클릭하여 포인트를 추가합니다.</li>
                    <li>포인트를 드래그하여 위치를 조정할 수 있습니다.</li>
                    <li>우클릭으로 포인트를 삭제할 수 있습니다.</li>
                    <li>테이블에서 직접 값을 입력하거나 수정할 수 있습니다.</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">4. 다항식 차수 설정</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Head와 Efficiency 각각 2차, 3차, 4차 다항식을 선택할 수 있습니다.</li>
                    <li>포인트가 2개 이상일 때 곡선이 그려집니다.</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">5. 배경 이미지 기능</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>이미지를 복사한 후 그래프 영역에 붙여넣기(Ctrl+V)하여 배경 이미지를 추가할 수 있습니다.</li>
                    <li>Background Opacity로 이미지 투명도를 조절할 수 있습니다.</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">6. 데이터 내보내기</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Copy to Clipboard: 테이블 형식으로 데이터를 복사합니다.</li>
                    <li>Export JSON: 모든 데이터를 JSON 파일로 저장합니다.</li>
                    <li>다항식 방정식을 개별적으로 복사할 수 있습니다.</li>
                  </ul>
                </div>
                <div>
                <h3 className="font-semibold mb-2">%%% 추후 설명 동영상 제공 예정%%%%</h3>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <hr className="my-6 border-t border-gray-700" />
          <div className="flex items-center gap-2">
     <Label htmlFor="caseName">Case 명:</Label>
     <Input
       id="caseName"
       value={caseInfo.caseName}
       readOnly
       className="flex-1 bg-yellow-200 h-8"
     />
   </div>
          <div className="flex justify-between items-center bg-gray-300">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4   bg-gray-300 rounded-lg flex-grow max-w-[1000px]">
           
           
           
           
           
           
           
           
           
              <div className="flex items-center gap-2">
                <Label htmlFor="projectName">PJT:</Label>
                <Input
                  id="projectName"
                  value={caseInfo.projectName}
                  onChange={(e) => setCaseInfo(prev => ({ ...prev, projectName: e.target.value }))}
                  className="flex-1 bg-white h-8 max-w-40 min-w-30"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="stage">단계:</Label>
                <select
                  id="stage"
                  title="단계 선택"
                  value={caseInfo.stage}
                  onChange={(e) => setCaseInfo(prev => ({ ...prev, stage: e.target.value }))}
                  className="flex-1 text-xs rounded-md border border-input bg-background px-3 py-2 h-9 max-w-40 bg-white"
                >
                  <option value="수행">수행</option>
                  <option value="견적">견적</option>
                  <option value="기타">기타</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="date">Date:</Label>
                <Input
                  id="date"
                  type="date"
                  value={caseInfo.date}
                  onChange={(e) => setCaseInfo(prev => ({ ...prev, date: e.target.value }))}
                  className="flex-1 bg-white h-9 max-w-40"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="pumpName">Pump Name:</Label>
                <Input
                  id="pumpName"
                  value={caseInfo.pumpName}
                  onChange={(e) => setCaseInfo(prev => ({ ...prev, pumpName: e.target.value }))}
                  className="flex-1 bg-white h-8 max-w-40"
                />
              </div>
            </div>
          </div>

          <hr className="border-gray-700" />

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Label htmlFor="maxHead">TDH Range:</Label>
              <Input
                id="maxHead"
                type="number"
                value={maxHead}
                onChange={(e) => setMaxHead(parseFloat(e.target.value) || 100)}
                className="w-24 h-8 bg-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="maxFlow">Flow Range:</Label>
              <Input
                id="maxFlow"
                type="number"
                value={maxFlow}
                onChange={(e) => setMaxFlow(parseFloat(e.target.value) || 100)}
                className="w-24  h-8 bg-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="maxEfficiency">Eff. Range:</Label>
              <Input
                id="maxEfficiency"
                type="number"
                value={maxEfficiency}
                onChange={(e) => setMaxEfficiency(parseFloat(e.target.value) || 100)}
                className="w-24 h-8 bg-white"
              />
            </div>
            <div className="flex items-center gap-4">
              <Label className="font-medium">Record mode:</Label>
              <div className="flex items-center bg-white rounded-lg border border-gray-200">
                <button
                  onClick={() => setSelectedMode('head')}
                  className={`px-6 py-2 rounded-md text-sm font-medium transition-all duration-200 border ${
                    selectedMode === 'head'
                      ? 'bg-white text-blue-600 border-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-blue-600 border-transparent hover:border-blue-300'
                  }`}
                >
                  Head
                </button>
                <button
                  onClick={() => setSelectedMode('efficiency')}
                  className={`px-2 py-2 rounded-md text-sm font-medium transition-all duration-200 border ${
                    selectedMode === 'efficiency'
                      ? 'bg-white text-red-600 border-red-600 shadow-sm'
                      : 'text-gray-600 hover:text-red-600 border-transparent hover:border-red-300'
                  }`}
                >
                  Efficiency
                </button>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex items-center bg-gray-300 p-2 ">
              <span className="mr-1 font-medium text-sm text-gray-700">Head Degree:</span>
              <div className="flex gap-1">
                {[2, 3, 4].map((degree) => (
                  <button
                    key={degree}
                    onClick={() => setHeadDegree(degree)}
                    className={`w-8 h-8 rounded-lg font-bold transition-all duration-200 ${
                      headDegree === degree
                        ? 'bg-blue-600 text-white shadow-lg scale-105 border-2 border-blue-600'
                        : 'bg-white text-gray-600 hover:bg-blue-50 border border-gray-300'
                    }`}
                  >
                    {degree}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center bg-gray-300 p-2 ">
              <span className="mr-3 font-medium text-sm text-gray-700">Efficiency Degree:</span>
              <div className="flex gap-1">
                {[2, 3, 4].map((degree) => (
                  <button
                    key={degree}
                    onClick={() => setEfficiencyDegree(degree)}
                    className={`w-8 h-8 rounded-lg font-bold transition-all duration-200 ${
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

          <div className="border rounded-lg bg-white p-6">
            {/* Add image controls */}
            <div className="flex items-center justify-between mb-6 px-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label htmlFor="imageOpacity" className="font-medium">Background Opacity:</Label>
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
                  <span className="font-medium">{(imageOpacity * 100).toFixed(0)}%</span>
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

            <div className="w-full max-w-[1800px] mx-auto space-y-4">
              <div className="flex justify-between px-4">
                <h3 className="text-blue-600 font-bold text-lg">TDH(m)</h3>  
                <h3 className="text-red-500 font-bold text-lg">Efficiency(%)</h3>
              </div>
              <div className="relative bg-white border-2 border-gray-200 rounded-lg shadow-inner">
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
                    maxHeight: '1000px'
                  }}
                />
              </div>
              <h3 className="text-center font-bold text-lg pt-2">Flowrate(m³/h)</h3>
            </div>
            
            {/* Move trend line equations here */}
            <hr className="my-2 border-t border-gray-300" />
            
            <div className="space-y-2 px-4">
              {headEquation && (
                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex-grow max-w-[1200px] overflow-hidden">
                    <span className="font-semibold text-blue-600">TDH = </span>
                    <span className="font-mono whitespace-nowrap overflow-x-auto">{headEquation}</span>
                  </div>
                  <div className="flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyEquation(headEquation, 'head-equation')}
                      className={`flex items-center gap-2 transition-colors duration-200 ${
                        copyEffect === 'head-equation' ? 'bg-green-100 text-green-700 border-green-500' : ''
                      }`}
                    >
                      <Copy className="h- w-4" />
                      Copy
                    </Button>
                  </div>
                </div>
              )}

              {efficiencyEquation && (
                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex-grow max-w-[1200px] overflow-hidden">
                    <span className="font-semibold text-red-600">Efficiency = </span>
                    <span className="font-mono whitespace-nowrap overflow-x-auto">{efficiencyEquation}</span>
                  </div>
                  <div className="flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyEquation(efficiencyEquation, 'efficiency-equation')}
                      className={`flex items-center gap-2 transition-colors duration-200 ${
                        copyEffect === 'efficiency-equation' ? 'bg-green-100 text-green-700 border-green-500' : ''
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

          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Points Data</h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyWithEffect(handleCopyAllPoints, 'copy-points')}
                  className={`flex items-center gap-2 transition-colors duration-200 ${
                    copyEffect === 'copy-points' ? 'bg-green-100 text-green-700 border-green-500' : ''
                  }`}
                >
                  <Table className="h-4 w-4" />
                  Copy to Clipboard
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportJson}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export JSON
                </Button>
              </div>
            </div>

            <div className="max-w-[800px] rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Head Points</h3>
              <table className="w-full border-collapse table-fixed bg-white">
                <colgroup>
                  <col className="w-[10%]" />
                  <col className="w-[20%]" />
                  <col className="w-[20%]" />
                  <col className="w-[20%]" />
                  <col className="w-[20%]" />
                  <col className="w-[10%]" />
                </colgroup>
                <thead>
                  <tr>
                    <th className="border p-2 text-left">No</th>
                    <th className="border p-2 text-left">Flow (%)</th>
                    <th className="border p-2 text-left">Flow (actual)</th>
                    <th className="border p-2 text-left">Head (%)</th>
                    <th className="border p-2 text-left">Head (actual)</th>
                    <th className="border p-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPoints.map((point, index) => (
                    <tr key={index}>
                      <td className="border p-2 text-left">{index + 1}</td>
                      <td className="border p-2 text-left">
                        <input
                          type="number"
                          value={point.x}
                          onChange={(e) => handleEditPoint(index, 'head', parseFloat(e.target.value), point.y)}
                          className="w-20"
                          title={`Edit flow percentage for point ${index + 1}`}
                          placeholder="Flow %"
                        />
                      </td>
                      <td className="border p-2 text-left">
                        {((point.x * maxFlow) / 100).toFixed(1)}
                      </td>
                      <td className="border p-2 text-left">
                        <input
                          type="number"
                          value={point.y}
                          onChange={(e) => handleEditPoint(index, 'head', point.x, parseFloat(e.target.value))}
                          className="w-20"
                          title={`Edit head percentage for point ${index + 1}`}
                          placeholder="Head %"
                        />
                      </td>
                      <td className="border p-2 text-left">
                        {((point.y * maxHead) / 100).toFixed(1)}
                      </td>
                      <td className="border p-2 text-left">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeletePoint(index, 'head')}
                          className="h-8 w-8"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="max-w-[800px] rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Efficiency Points</h3>
              <table className="w-full border-collapse table-fixed bg-white">
                <colgroup>
                  <col className="w-[10%]" />
                  <col className="w-[20%]" />
                  <col className="w-[20%]" />
                  <col className="w-[20%]" />
                  <col className="w-[20%]" />
                  <col className="w-[10%]" />
                </colgroup>
                <thead>
                  <tr>
                    <th className="border p-2 text-left">No</th>
                    <th className="border p-2 text-left">Flow (%)</th>
                    <th className="border p-2 text-left">Flow (actual)</th>
                    <th className="border p-2 text-left">Efficiency (%)</th>
                    <th className="border p-2 text-left">Efficiency (actual)</th>
                    <th className="border p-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedEfficiencyPoints.map((point, index) => (
                    <tr key={index}>
                      <td className="border p-2 text-left">{index + 1}</td>
                      <td className="border p-2 text-left">
                        <input
                          type="number"
                          value={point.x}
                          onChange={(e) => handleEditPoint(index, 'efficiency', parseFloat(e.target.value), point.y)}
                          className="w-20"
                          title={`Edit flow percentage for efficiency point ${index + 1}`}
                          placeholder="Flow %"
                        />
                      </td>
                      <td className="border p-2 text-left">
                        {((point.x * maxFlow) / 100).toFixed(1)}
                      </td>
                      <td className="border p-2 text-left">
                        <input
                          type="number"
                          value={point.y}
                          onChange={(e) => handleEditPoint(index, 'efficiency', point.x, parseFloat(e.target.value))}
                          className="w-20"
                          title={`Edit efficiency percentage for point ${index + 1}`}
                          placeholder="Efficiency %"
                        />
                      </td>
                      <td className="border p-2 text-left">
                        {((point.y * maxEfficiency) / 100).toFixed(1)}
                      </td>
                      <td className="border p-2 text-left">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeletePoint(index, 'efficiency')}
                          className="h-8 w-8"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PumpCurveNew2; 