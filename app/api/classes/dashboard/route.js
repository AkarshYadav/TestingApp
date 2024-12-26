// app/api/classes/dashboard/route.js
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import connect from "@/lib/mongodb/mongoose";
import User from "@/lib/models/user.model";
import Class from "@/lib/models/class.model";
import Enrollment from "@/lib/models/enrollment.model";

export async function GET() {
  try {
    // Connect to the database and fetch session concurrently
    const [session] = await Promise.all([connect(), getServerSession()]);

    if (!session) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Find the user by email
    const user = await User.findOne({ email: session.user.email }).lean();
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Fetch created classes and active enrollments concurrently
    const [createdClasses, activeEnrollments] = await Promise.all([
      Class.find({ _id: { $in: user.createdClasses } })
        .select("className subject classCode description section")
        .lean(),
      Enrollment.find({
        _id: { $in: user.enrolledIn },
        status: "active",
      })
        .populate({
          path: "class",
          select: "className subject classCode description section creator",
          populate: {
            path: "creator",
            select: "email",
          },
        })
        .lean(),
    ]);

    // Extract class data from active enrollments
    const enrolledClasses = activeEnrollments.map((enrollment) => enrollment.class);

    return NextResponse.json({
      createdClasses,
      enrolledClasses,
    });
  } catch (error) {
    console.error("Dashboard API Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
