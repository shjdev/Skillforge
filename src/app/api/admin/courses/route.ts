import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, ownerVisibilityWhere } from "@/lib/serverAuth";

export async function GET() {
  try {
    // Catalogue commun + contenu du profil connecté (pas les thèmes personnels des testeurs).
    const visibility = ownerVisibilityWhere(await getCurrentUserId());
    const domains = await prisma.domain.findMany({
      where: visibility,
      include: {
        topics: {
          where: visibility,
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
