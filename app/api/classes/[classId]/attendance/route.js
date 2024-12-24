import { validateSession } from '@/lib/session';
import { NextResponse } from "next/server";
import connect from "@/lib/mongodb/mongoose";
import Class from "@/lib/models/class.model";
import Enrollment from "@/lib/models/enrollment.model";
import AttendanceSession from "@/lib/models/attendance.model";

// Helper function to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
}

export async function POST(req, { params }) {
    try {
        const [session] = await Promise.all([
            validateSession(),
            connect()
        ]);

        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { location, radius, duration } = await req.json();
        const classId = params.classId;

        // Verify user is the class creator
        const classDoc = await Class.findById(classId);
        if (!classDoc || classDoc.creator.toString() !== session.user.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Check for active session
        const activeSession = await AttendanceSession.findOne({
            class: classId,
            status: 'active'
        });

        if (activeSession) {
            return NextResponse.json(
                { error: "An active attendance session already exists" },
                { status: 400 }
            );
        }

        // Create attendance session
        const endTime = new Date(Date.now() + duration * 1000);
        const attendanceSession = await AttendanceSession.create({
            class: classId,
            creator: session.user.id,
            endTime,
            location: {
                type: 'Point',
                coordinates: [location.longitude, location.latitude]
            },
            radius,
            status: 'active'
        });

        // Schedule session end
        setTimeout(async () => {
            await AttendanceSession.findByIdAndUpdate(
                attendanceSession._id,
                { status: 'completed' }
            );
        }, duration * 1000);

        return NextResponse.json({
            message: "Attendance session started",
            sessionId: attendanceSession._id
        });

    } catch (error) {
        console.error('Error starting attendance:', error);
        return NextResponse.json(
            { error: "Failed to start attendance session" },
            { status: 500 }
        );
    }
}

export async function PUT(req, { params }) {
    try {
        const [session] = await Promise.all([
            validateSession(),
            connect()
        ]);

        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { sessionId, location, duration } = await req.json();
        const classId = params.classId;

        // Handle session extension
        if (duration) {
            const classDoc = await Class.findById(classId);
            if (!classDoc || classDoc.creator.toString() !== session.user.id) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }

            const existingSession = await AttendanceSession.findById(sessionId);
            if (!existingSession) {
                return NextResponse.json(
                    { error: "Attendance session not found" },
                    { status: 404 }
                );
            }

            const newEndTime = new Date(existingSession.endTime.getTime() + duration * 1000);
            const updatedSession = await AttendanceSession.findByIdAndUpdate(
                sessionId,
                { endTime: newEndTime, status: 'active' },
                { new: true }
            );

            setTimeout(async () => {
                await AttendanceSession.findByIdAndUpdate(
                    updatedSession._id,
                    { status: 'completed' }
                );
            }, newEndTime.getTime() - Date.now());

            return NextResponse.json({
                message: "Attendance session extended",
                sessionId: updatedSession._id,
                newEndTime
            });
        }

        // Handle attendance marking
        const enrollment = await Enrollment.findOne({
            class: classId,
            student: session.user.id,
            status: 'active'
        });

        if (!enrollment) {
            return NextResponse.json(
                { error: "Not enrolled in this class" },
                { status: 401 }
            );
        }

        const attendanceSession = await AttendanceSession.findOne({
            _id: sessionId,
            class: classId,
            status: 'active'
        });

        if (!attendanceSession) {
            return NextResponse.json(
                { error: "No active attendance session found" },
                { status: 404 }
            );
        }

        // Calculate distance using the original working method
        const teacherLat = attendanceSession.location.coordinates[1];
        const teacherLon = attendanceSession.location.coordinates[0];
        const studentLat = location.latitude;
        const studentLon = location.longitude;

        const distance = calculateDistance(
            studentLat,
            studentLon,
            teacherLat,
            teacherLon
        );

        // Debug information
        console.log({
            teacherLocation: {
                latitude: teacherLat,
                longitude: teacherLon
            },
            studentLocation: {
                latitude: studentLat,
                longitude: studentLon
            },
            calculatedDistance: Math.round(distance),
            allowedRadius: attendanceSession.radius
        });

        if (distance > attendanceSession.radius) {
            return NextResponse.json(
                {
                    error: "Location verification failed",
                    details: {
                        distance: Math.round(distance),
                        allowedRadius: attendanceSession.radius,
                        teacherLocation: {
                            latitude: teacherLat,
                            longitude: teacherLon
                        },
                        studentLocation: {
                            latitude: studentLat,
                            longitude: studentLon
                        }
                    }
                },
                { status: 400 }
            );
        }

        const alreadyMarked = attendanceSession.attendees.some(
            a => a.student.toString() === session.user.id
        );

        if (alreadyMarked) {
            return NextResponse.json(
                { error: "Attendance already marked" },
                { status: 400 }
            );
        }

        await AttendanceSession.findByIdAndUpdate(
            sessionId,
            {
                $push: {
                    attendees: {
                        student: session.user.id,
                        location: {
                            type: 'Point',
                            coordinates: [location.longitude, location.latitude]
                        },
                        distanceFromTeacher: Math.round(distance)
                    }
                }
            }
        );

        return NextResponse.json({ 
            message: "Attendance marked successfully",
            distance: Math.round(distance)
        });

    } catch (error) {
        console.error('Error handling PUT request:', error);
        return NextResponse.json(
            { error: "Failed to process request" },
            { status: 500 }
        );
    }
}
// Get attendance session status
export async function GET(req, { params }) {
    try {
        const [session] = await Promise.all([
            validateSession(),
            connect()
        ]);

        const classId = params.classId;

        // Verify class access concurrently
        const [enrollment, classDoc, activeSession] = await Promise.all([
            Enrollment.findOne({
                class: classId,
                student: session.user.id,
                status: 'active'
            }).lean(),
            Class.findById(classId, { creator: 1 }).lean(),
            AttendanceSession.findOne({
                class: classId,
                status: 'active'
            }).lean()
        ]);

        if (!enrollment && classDoc.creator.toString() !== session.user.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!activeSession) {
            return NextResponse.json({ active: false });
        }

        const hasMarked = activeSession.attendees.some(
            a => a.student.toString() === session.user.id
        );

        return NextResponse.json({
            active: true,
            sessionId: activeSession._id,
            hasMarked,
            endTime: activeSession.endTime
        });

    } catch (error) {
        console.error('Error getting attendance status:', error);
        return NextResponse.json(
            { error: "Failed to get attendance status" },
            { status: 500 }
        );
    }
}

// End attendance session
export async function PATCH(req, { params }) {
    try {
        const [session] = await Promise.all([
            validateSession(),
            connect()
        ]);

        const { sessionId } = await req.json();
        const classId = params.classId;

        await AttendanceController.verifyTeacher(classId, session.user.id);

        await AttendanceSession.findByIdAndUpdate(
            sessionId,
            { status: 'completed' }
        );

        return NextResponse.json({ message: "Attendance session ended" });

    } catch (error) {
        console.error('Error ending attendance session:', error);
        return NextResponse.json(
            { error: error.message === 'Unauthorized' ? "Unauthorized" : "Failed to end attendance session" },
            { status: error.message === 'Unauthorized' ? 401 : 500 }
        );
    }
}