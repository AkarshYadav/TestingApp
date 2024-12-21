import { validateSession } from '@/lib/session';
import { NextResponse } from "next/server";
import connect from "@/lib/mongodb/mongoose";
import Class from "@/lib/models/class.model";
import Enrollment from "@/lib/models/enrollment.model";
import AttendanceSession from "@/lib/models/attendance.model";

// Helper function to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Attendance Session Controller
class AttendanceController {
    static async verifyTeacher(classId, userId) {
        const classDoc = await Class.findById(classId, { creator: 1 }).lean();
        if (!classDoc || classDoc.creator.toString() !== userId) {
            throw new Error('Unauthorized');
        }
        return classDoc;
    }

    static async startSession(classId, userId, location, radius, duration) {
        const [existingSession] = await Promise.all([
            AttendanceSession.findOne({
                class: classId,
                status: 'active'
            }).lean(),
            this.verifyTeacher(classId, userId)
        ]);

        if (existingSession) {
            throw new Error('ActiveSessionExists');
        }

        const endTime = new Date(Date.now() + duration * 1000);
        return await AttendanceSession.create({
            class: classId,
            creator: userId,
            endTime,
            location: {
                type: 'Point',
                coordinates: [location.longitude, location.latitude]
            },
            radius,
            status: 'active'
        });
    }

    static async extendSession(sessionId, userId, classId, duration) {
        await this.verifyTeacher(classId, userId);

        const existingSession = await AttendanceSession.findById(sessionId).lean();
        if (!existingSession) {
            throw new Error('SessionNotFound');
        }

        const newEndTime = new Date(existingSession.endTime.getTime() + duration * 1000);
        return await AttendanceSession.findByIdAndUpdate(
            sessionId,
            { endTime: newEndTime, status: 'active' },
            { new: true }
        ).lean();
    }

    static async markAttendance(sessionId, userId, classId, location) {
        const [enrollment, attendanceSession] = await Promise.all([
            Enrollment.findOne({
                class: classId,
                student: userId,
                status: 'active'
            }).lean(),
            AttendanceSession.findOne({
                _id: sessionId,
                class: classId,
                status: 'active'
            }).lean()
        ]);

        if (!enrollment) throw new Error('NotEnrolled');
        if (!attendanceSession) throw new Error('NoActiveSession');

        const distance = calculateDistance(
            location.latitude,
            location.longitude,
            attendanceSession.location.coordinates[1],
            attendanceSession.location.coordinates[0]
        );

        if (distance > attendanceSession.radius) {
            throw new Error('TooFar');
        }

        const alreadyMarked = attendanceSession.attendees.some(
            a => a.student.toString() === userId
        );

        if (alreadyMarked) throw new Error('AlreadyMarked');

        return await AttendanceSession.findByIdAndUpdate(
            sessionId,
            {
                $push: {
                    attendees: {
                        student: userId,
                        location: {
                            type: 'Point',
                            coordinates: [location.longitude, location.latitude]
                        }
                    }
                }
            }
        ).lean();
    }
}

// Start attendance session
export async function POST(req, { params }) {
    try {
        const [session] = await Promise.all([
            validateSession(),
            connect()
        ]);

        const { location, radius, duration } = await req.json();
        const classId = params.classId;

        const attendanceSession = await AttendanceController.startSession(
            classId,
            session.user.id,
            location,
            radius,
            duration
        );

        // Schedule session end without blocking
        const sessionTimeout = new Promise((resolve) => {
            setTimeout(async () => {
                await AttendanceSession.findByIdAndUpdate(
                    attendanceSession._id,
                    { status: 'completed' }
                );
                resolve();
            }, duration * 1000);
        });
        sessionTimeout.catch(console.error);

        return NextResponse.json({
            message: "Attendance session started",
            sessionId: attendanceSession._id
        });

    } catch (error) {
        console.error('Error starting attendance:', error);
        return NextResponse.json(
            { error: error.message === 'ActiveSessionExists' 
                ? "An active attendance session already exists"
                : "Failed to start attendance session" 
            },
            { status: error.message === 'Unauthorized' ? 401 : 400 }
        );
    }
}

// Mark attendance or extend session
export async function PUT(req, { params }) {
    try {
        const [session] = await Promise.all([
            validateSession(),
            connect()
        ]);

        const { sessionId, location, duration } = await req.json();
        const classId = params.classId;

        if (duration) {
            const updatedSession = await AttendanceController.extendSession(
                sessionId,
                session.user.id,
                classId,
                duration
            );

            // Schedule new session end
            const sessionTimeout = new Promise((resolve) => {
                setTimeout(async () => {
                    await AttendanceSession.findByIdAndUpdate(
                        updatedSession._id,
                        { status: 'completed' }
                    );
                    resolve();
                }, updatedSession.endTime.getTime() - Date.now());
            });
            sessionTimeout.catch(console.error);

            return NextResponse.json({
                message: "Attendance session extended",
                sessionId: updatedSession._id,
                newEndTime: updatedSession.endTime
            });
        }

        await AttendanceController.markAttendance(
            sessionId,
            session.user.id,
            classId,
            location
        );

        return NextResponse.json({ message: "Attendance marked successfully" });

    } catch (error) {
        console.error('Error handling PUT request:', error);
        const errorResponses = {
            'Unauthorized': { message: "Unauthorized", status: 401 },
            'NotEnrolled': { message: "Not enrolled in this class", status: 401 },
            'NoActiveSession': { message: "No active attendance session found", status: 404 },
            'TooFar': { message: "You are too far from the class location", status: 400 },
            'AlreadyMarked': { message: "Attendance already marked", status: 400 },
            'SessionNotFound': { message: "Attendance session not found", status: 404 }
        };

        const response = errorResponses[error.message] || 
            { message: "Failed to process request", status: 500 };

        return NextResponse.json(
            { error: response.message },
            { status: response.status }
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