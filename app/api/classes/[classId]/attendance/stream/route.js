import { getServerSession } from 'next-auth/next';
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import connect from "@/lib/mongodb/mongoose";
import AttendanceSession from "@/lib/models/attendance.model";

export async function GET(request, context) {
  // Ensure MongoDB connection
  await connect();

  // Authenticate the user
  const session = await getServerSession(authOptions);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Await params to avoid sync-access error
  const { classId } = await context.params;

  // Set up the readable stream
  const stream = new ReadableStream({
    start(controller) {
      let intervalId; // For polling attendance
      let isStreamClosed = false; // Track if the stream is closed

      // Function to send SSE events to the client
      const sendEvent = (data) => {
        if (isStreamClosed) return;

        try {
          const formattedEvent = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(new TextEncoder().encode(formattedEvent));
        } catch (error) {
          console.error("Error while sending event:", error);
          cleanup(); // Ensure cleanup if sending fails
        }
      };

      // Function to poll the attendance data
      const fetchAttendance = async () => {
        try {
          const activeSession = await AttendanceSession.findOne({
            class: classId,
            status: 'active',
          }).populate('attendees.student', 'name collegeId');

          if (activeSession) {
            sendEvent({
              type: 'attendance-update',
              attendees: activeSession.attendees.map((attendee) => ({
                name: attendee.student.name,
                collegeId: attendee.student.collegeId,
                markedAt: attendee.markedAt,
              })),
            });
          }
        } catch (error) {
          console.error("Error fetching attendance:", error);
        }
      };

      // Start polling immediately and every 5 seconds
      fetchAttendance();
      intervalId = setInterval(fetchAttendance, 5000);

      // Cleanup function for resources
      const cleanup = () => {
        if (isStreamClosed) return;
        isStreamClosed = true;
        if (intervalId) clearInterval(intervalId); // Stop polling
        controller.close(); // Close the stream
      };

      // Listen for client disconnection
      request.signal.addEventListener("abort", () => {
        console.log("Client disconnected. Cleaning up...");
        cleanup();
      });
    },

    cancel() {
      console.log("Stream canceled.");
    },
  });

  // Return the stream as an SSE response
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

