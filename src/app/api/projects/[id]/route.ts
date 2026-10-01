import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface Params {
  params: Promise<{ id: string }>;
}

// GET /api/projects/[id] - Fetch single saved project with full 3D model & sketch data
export async function GET(request: NextRequest, { params }: Params) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { success: false, error: 'DATABASE_URL is not configured in .env' },
        { status: 503 }
      );
    }

    const { id } = await params;
    const project = await (prisma as any).savedProject.findUnique({
      where: { id },
    });

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, project });
  } catch (error: any) {
    console.error(`Error fetching project:`, error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch project.' },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id] - Delete a saved project
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { success: false, error: 'DATABASE_URL is not configured in .env' },
        { status: 503 }
      );
    }

    const { id } = await params;
    await (prisma as any).savedProject.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Project successfully deleted from database.',
    });
  } catch (error: any) {
    console.error(`Error deleting project:`, error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete project.' },
      { status: 500 }
    );
  }
}
