import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/projects - Retrieve all saved projects
export async function GET() {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'DATABASE_URL is not configured in .env', 
          projects: [] 
        }, 
        { status: 503 }
      );
    }

    const projects = await (prisma as any).savedProject.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        totalBricks: true,
        totalCost: true,
        cementBags: true,
        sandVolumeCft: true,
        buildingLength: true,
        buildingWidth: true,
        buildingUnit: true,
        floorsCount: true,
        createdAt: true,
        updatedAt: true,
        // Omit huge JSON tree from list response for fast loading
      },
    });

    return NextResponse.json({ success: true, projects });
  } catch (error: any) {
    console.error('Error fetching saved projects:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to fetch saved projects',
        projects: [] 
      },
      { status: 500 }
    );
  }
}

// POST /api/projects - Save a new project to PostgreSQL
export async function POST(request: NextRequest) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'DATABASE_URL is not configured in .env. Please configure your PostgreSQL connection string.' 
        }, 
        { status: 503 }
      );
    }

    const body = await request.json();
    const {
      name,
      modelData,
      totalBricks = 0,
      totalCost = 0,
      cementBags = 0,
      sandVolumeCft = 0,
      buildingLength = 0,
      buildingWidth = 0,
      buildingUnit = 'ft',
      floorsCount = 1,
      settingsData = null,
      brickTypeData = null,
      estimationData = null,
      userId = null,
    } = body;

    if (!name || !modelData) {
      return NextResponse.json(
        { success: false, error: 'Project name and 3D model data are required.' },
        { status: 400 }
      );
    }

    const sanitizedBricks = isNaN(Number(totalBricks)) ? 0 : Math.round(Number(totalBricks));
    const sanitizedCost = isNaN(Number(totalCost)) ? 0 : Number(totalCost);
    const sanitizedLength = isNaN(Number(buildingLength)) ? 0 : Number(buildingLength);
    const sanitizedWidth = isNaN(Number(buildingWidth)) ? 0 : Number(buildingWidth);
    const sanitizedFloors = isNaN(Number(floorsCount)) ? 1 : Math.max(1, Number(floorsCount));

    // Ensure clean JSON objects without undefined/functions
    const safeModelData = JSON.parse(JSON.stringify(modelData));
    const safeSettingsData = settingsData ? JSON.parse(JSON.stringify(settingsData)) : undefined;
    const safeBrickTypeData = brickTypeData ? JSON.parse(JSON.stringify(brickTypeData)) : undefined;
    const safeEstimationData = estimationData ? JSON.parse(JSON.stringify(estimationData)) : undefined;

    const savedProject = await (prisma as any).savedProject.create({
      data: {
        name: String(name).trim(),
        totalBricks: sanitizedBricks,
        totalCost: sanitizedCost,
        cementBags: cementBags && !isNaN(Number(cementBags)) ? Number(cementBags) : null,
        sandVolumeCft: sandVolumeCft && !isNaN(Number(sandVolumeCft)) ? Number(sandVolumeCft) : null,
        buildingLength: sanitizedLength,
        buildingWidth: sanitizedWidth,
        buildingUnit: String(buildingUnit || 'ft'),
        floorsCount: sanitizedFloors,
        modelData: safeModelData,
        settingsData: safeSettingsData,
        brickTypeData: safeBrickTypeData,
        estimationData: safeEstimationData,
        userId: userId || undefined,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Project successfully saved to PostgreSQL database.',
      project: savedProject,
    });
  } catch (error: any) {
    console.error('Error saving project to PostgreSQL:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to save project to database.' 
      },
      { status: 500 }
    );
  }
}
