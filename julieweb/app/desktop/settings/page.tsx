import { redirect } from "next/navigation";

type Props = {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DesktopSettingsRedirect(props: Props) {
    const searchParams = await props.searchParams;
    const qs = new URLSearchParams();
    Object.entries(searchParams).forEach(([key, value]) => {
        if (Array.isArray(value)) {
            value.forEach((v) => qs.append(key, v));
        } else if (value !== undefined) {
            qs.set(key, value);
        }
    });
    const suffix = qs.toString();
    const target = suffix ? `/desktop/link?${suffix}` : "/desktop/link";
    redirect(target);
}
