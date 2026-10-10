import { generateMetadata } from "@/app/us/tender/[id]/page";
import { searchUsTenders } from "@/lib/us/repository";

async function main() {
  const { items } = await searchUsTenders({ limit: 1 });
  if (items.length === 0) {
    throw new Error("No active US tender available for metadata regression test");
  }

  const id = String(items[0].id);
  const metadata = await generateMetadata({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) });
  const canonical = metadata.alternates && typeof metadata.alternates === "object" && "canonical" in metadata.alternates
    ? metadata.alternates.canonical
    : undefined;

  if (canonical !== `/us/tender/${id}`) {
    throw new Error(`Expected self-canonical /us/tender/${id}, received ${String(canonical)}`);
  }

  const queryMetadata = await generateMetadata({
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve({ utm_source: "gsc" }),
  });
  const queryRobots = queryMetadata.robots;
  if (typeof queryRobots !== "object" || queryRobots === null || queryRobots.index !== false || queryRobots.follow !== true) {
    throw new Error("US tender query URLs must be noindex, follow");
  }

  console.log("US tender self-canonical and query-indexability regression tests passed.");
}

void main();
