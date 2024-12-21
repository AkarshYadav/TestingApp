// Optimized SSE route
export async function GET(request, context) {
  try {
    await Promise.all([validateSession(), connectDB()]);
    
    const { classId } = await context.params;
    let lastAttendees = null;

    const stream = new ReadableStream({
      start(controller) {
        let intervalId;
        let isStreamClosed = false;

        const sendEvent = (data) => {
          if (isStreamClosed) return;
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        const fetchAttendance = async () => {
          try {
            // Only fetch necessary fields
            const activeSession = await AttendanceSession.findOne(
              { class: classId, status: 'active' },
              { 'attendees.student': 1, 'attendees.markedAt': 1 }
            ).lean();

            if (activeSession) {
              // Only send updates if data has changed
              const currentAttendees = JSON.stringify(activeSession.attendees);
              if (currentAttendees !== lastAttendees) {
                lastAttendees = currentAttendees;
                sendEvent({
                  type: 'attendance-update',
                  attendees: activeSession.attendees
                });
              }
            }
          } catch (error) {
            console.error("Error fetching attendance:", error);
          }
        };

        fetchAttendance();
        intervalId = setInterval(fetchAttendance, 5000);

        request.signal.addEventListener("abort", () => {
          isStreamClosed = true;
          clearInterval(intervalId);
          controller.close();
        });
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}