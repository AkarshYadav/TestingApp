// app/api/classes/[classId]/route.js
import { validateSession } from '@/lib/session';  // CHANGED: Using cached session
import { NextResponse } from "next/server";
import connect from "@/lib/mongodb/mongoose";
import User from "@/lib/models/user.model";
import Class from "@/lib/models/class.model";
import Enrollment from "@/lib/models/enrollment.model";

export async function GET(request, { params }) {
  try {
    const { classId } = params;

    // CHANGED: Moved validation before DB operations
    if (!classId) {
      return NextResponse.json(
        { error: "Class ID is required" },
        { status: 400 }
      );
    }

    // CHANGED: Run connection and session validation concurrently
    const [session] = await Promise.all([
      validateSession(),
      connect()
    ]);

    // CHANGED: Added projection to user query for better performance
    const [user, classData, enrollment] = await Promise.all([
      User.findOne(
        { email: session.user.email },
        { _id: 1 }  // CHANGED: Only fetch needed fields
      ).lean(),
      
      Class.findById(classId)
        .select("className subject classCode description section creator materials")
        .populate("creator", "email")
        .lean(),
      
      Enrollment.findOne(
        {
          student: session.user.id,
          class: classId,
          status: "active"
        },
        { _id: 1 }  // CHANGED: Only fetch needed fields
      ).lean()
    ]);

    // CHANGED: Combined user and class validation
    if (!user || !classData) {
      return NextResponse.json(
        { error: !user ? "User not found" : "Class not found" },
        { status: 404 }
      );
    }

    // CHANGED: Simplified role determination
    const userRole = (() => {
      if (classData.creator._id.toString() === user._id.toString()) return "teacher";
      if (enrollment) return "student";
      return null;
    })();

    if (!userRole) {
      return NextResponse.json(
        { error: "Not authorized to access this class" },
        { status: 403 }
      );
    }

    // CHANGED: Destructured response data for clarity
    const { _id, className, subject, classCode, description, section, materials, creator } = classData;

    return NextResponse.json({
      classData: {
        _id,
        className,
        subject,
        classCode,
        description,
        section,
        materials,
        creator: {
          email: creator.email
        }
      },
      userRole
    });

  } catch (error) {
    // CHANGED: Added specific error handling
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }
    
    console.error("Class API Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}