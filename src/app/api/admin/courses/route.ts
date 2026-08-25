import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const domains = await prisma.domain.findMany({
      include: {
        topics: {
          include: {
            lessons: true,
          },
          orderBy: {
            slug: 'asc',
          }
        },
      },
      orderBy: {
        order: 'asc',
      }
    });
    
    return NextResponse.json(domains);
  } catch (error) {
    console.error("Error fetching courses data:", error);
    return NextResponse.json({ error: "Failed to fetch courses data" }, { status: 500 });
  }
}
