import { notFound } from "next/navigation";
import { DIAGRAMS } from "../../../lib/site.mjs";
import Viewer from "./Viewer.jsx";

export function generateStaticParams() {
  return DIAGRAMS.map(([slug]) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const d = DIAGRAMS.find(([s]) => s === slug);
  const title = d ? d[1].replace(" (zoom)", "") : slug;
  return { title: `${title} · MapleOne Architecture` };
}

export default async function ViewPage({ params }) {
  const { slug } = await params;
  const d = DIAGRAMS.find(([s]) => s === slug);
  if (!d) notFound();
  return <Viewer slug={slug} title={d[1].replace(" (zoom)", "")} />;
}
