import { PageTransition } from "@/components/motion/terminal";

// A template re-renders on every navigation, so the fade/slide fires per route.
export default function Template({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
