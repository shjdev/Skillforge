import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { DomainSchema } from "@/lib/schemas/admin.schema";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Zod validation
    const validatedData = DomainSchema.parse(body);
    
    const domain = await prisma.domain.create({
      data: {
        name: validatedData.name,
        slug: validatedData.slug,
        description: validatedData.description,
        icon: validatedData.icon,
        color: validatedData.color,
        order: validatedData.order,
        isActive: validatedData.isActive,
      }
    });

    return NextResponse.json(domain, { status: 201 });
  } catch (error) {
    console.error("Error creating domain:", error);
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
