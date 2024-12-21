// app/api/classes/dashboard/route.js
import { validateSession } from '@/lib/session';
import connect from "@/lib/mongodb/mongoose";
import { NextResponse } from "next/server";
import User from "@/lib/models/user.model";
import Class from "@/lib/models/class.model";
import Enrollment from "@/lib/models/enrollment.model";

export async function GET() {
  try {
    // Connect DB and validate session concurrently
    const [session] = await Promise.all([
      validateSession(),
      connect()
    ]);

    // Find user and fetch classes concurrently
    const [user] = await Promise.all([
      User.findOne({ email: session.user.email })
    ]);

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Fetch created classes and enrollments concurrently
    const [createdClasses, enrollments] = await Promise.all([
      Class.find({
        _id: { $in: user.createdClasses }
      }).select('className subject classCode description section'),
      
      Enrollment.find({
        _id: { $in: user.enrolledIn },
        status: 'active'
      }).populate({
        path: 'class',
        select: 'className subject classCode description section creator',
        populate: {
          path: 'creator',
          select: 'email'
        }
      }).lean()
    ]);

    // Extract class data from enrollments
    const enrolledClasses = enrollments.map(enrollment => enrollment.class);

    return NextResponse.json({
      createdClasses,
      enrolledClasses
    });

  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }
    console.error('Dashboard API Error:', error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}