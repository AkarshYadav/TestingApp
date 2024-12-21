import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { cache } from 'react';

// Cache the getServerSession call
export const getSessionCache = cache(async () => {
  return await getServerSession(authOptions);
});

// Utility function to verify session and return user
export async function validateSession() {
  const session = await getSessionCache();
  if (!session) {
    throw new Error('Unauthorized');
  }
  return session;
}
