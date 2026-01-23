import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function GET(request: Request) {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();

    // Delete all cookies
    allCookies.forEach((cookie) => {
        cookieStore.delete(cookie.name);
    });

    console.log("Cleared cookies:", allCookies.map(c => c.name));

    return redirect("/login");
}
