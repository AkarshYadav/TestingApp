import connect from "@/lib/mongodb/mongoose";
import AttendanceKey from "@/lib/models/AttendanceKey.model";

export const GET = async (req, { params }) => {
    try {
        // Extract classId from both URL params and query params
        const url = new URL(req.url);
        const queryClassId = url.searchParams.get('classId');
        const urlClassId = url.pathname.split('/').filter(Boolean)[2]; // Extracts from URL path
        
        // Use either the query param or URL param
        const classId = queryClassId || urlClassId;

        if (!classId) {
            console.log("Missing classId in both query and URL params");
            return new Response(
                JSON.stringify({ 
                    success: false,
                    message: "Missing classId parameter" 
                }),
                { 
                    status: 400,
                    headers: {
                        'Content-Type': 'application/json',
                    }
                }
            );
        }

        // Connect to the database
        await connect();
        console.log("Querying Database for Class ID:", classId);

        // Fetch the latest attendance key for the class
        const latestKey = await AttendanceKey.findOne({ classId })
            .sort({ createdAt: -1 })
            .select('key createdAt')
            .lean()
            .exec();

        if (!latestKey) {
            console.log("No key found for class:", classId);
            return new Response(
                JSON.stringify({ 
                    success: false,
                    message: "No active key found for this class" 
                }),
                { 
                    status: 404,
                    headers: {
                        'Content-Type': 'application/json',
                    }
                }
            );
        }

        // Check if the key is still valid (optional: add your own expiry logic)
        console.log("Latest Key Retrieved for class:", classId);
        
        return new Response(
            JSON.stringify({ 
                success: true,
                latestKey: latestKey.key 
            }),
            { 
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-store' // Prevent caching
                }
            }
        );
    } catch (error) {
        console.error("Error in get-latest-key route:", error);
        return new Response(
            JSON.stringify({ 
                success: false,
                message: "Internal server error",
                error: error.message 
            }),
            { 
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                }
            }
        );
    }
};