import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Box, Button, Chip, Container, Divider, Stack, Typography } from "@mui/material";
import { ArrowLeft, Building2, CalendarClock, ExternalLink, MapPin } from "lucide-react";
import { UsPursuitPanel } from "@/components/UsPursuitPanel";
import { getUsTenderById, isActiveUsTender, serializeUsTender } from "@/lib/us/repository";

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = Number.parseInt((await params).id, 10);
  const tender = Number.isFinite(id) ? await getUsTenderById(id) : null;
  return tender && isActiveUsTender(tender) ? { title: tender.title, description: tender.description?.slice(0, 160) } : { title: "Opportunity not found" };
}

export default async function UsTenderPage({ params }: Props) {
  const id = Number.parseInt((await params).id, 10);
  const tender = Number.isFinite(id) ? await getUsTenderById(id) : null;
  if (!tender || !isActiveUsTender(tender)) notFound();
  const item = serializeUsTender(tender, true);

  return (
    <Box sx={{ bgcolor: "#f7fafc", minHeight: "100vh", py: { xs: 3, md: 6 } }}>
      <Container maxWidth="lg">
        <Stack spacing={3}>
          <Button component={Link} href="/us" startIcon={<ArrowLeft size={17} />} sx={{ alignSelf: "flex-start" }}>All U.S. opportunities</Button>
          <Box sx={{ bgcolor: "white", border: "1px solid #d6e0e9", borderRadius: 3, p: { xs: 2.25, md: 4 } }}>
            <Stack spacing={2}>
              <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", rowGap: 0.75 }}>
                <Chip label={item.subcontracting ? "Subcontracting opportunity" : "Federal opportunity"} color={item.subcontracting ? "secondary" : "primary"} size="small" />
                {item.setAside && <Chip label={item.setAside} size="small" variant="outlined" />}
                {item.naicsCodes.map((code) => <Chip key={code} label={`NAICS ${code}`} size="small" variant="outlined" />)}
              </Stack>
              <Typography component="h1" sx={{ color: "#102a43", fontSize: { xs: "2rem", md: "3.2rem" }, fontWeight: 850, lineHeight: 1.05, letterSpacing: "-0.04em" }}>{item.title}</Typography>
              <Stack direction={{ xs: "column", md: "row" }} spacing={{ xs: 1, md: 2.5 }} color="text.secondary">
                {item.buyer && <Typography sx={{ display: "flex", alignItems: "center", gap: 0.6 }}><Building2 size={17} />{item.buyer}</Typography>}
                {item.location && <Typography sx={{ display: "flex", alignItems: "center", gap: 0.6 }}><MapPin size={17} />{item.location}</Typography>}
                {item.deadline && <Typography sx={{ display: "flex", alignItems: "center", gap: 0.6, color: "#984e16", fontWeight: 750 }}><CalendarClock size={17} />Due {item.deadline}</Typography>}
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Button variant="contained" href={item.sourceUrl} target="_blank" endIcon={<ExternalLink size={17} />} sx={{ bgcolor: "#0d5c80" }}>Open official listing</Button>
                {item.solicitationNumber && <Chip label={`Solicitation ${item.solicitationNumber}`} variant="outlined" sx={{ alignSelf: { sm: "center" } }} />}
              </Stack>
              <Divider />
              <Typography variant="h6" fontWeight={800}>Requirement summary</Typography>
              <Typography sx={{ whiteSpace: "pre-wrap", color: "text.secondary", lineHeight: 1.75 }}>{item.description || "The official listing does not expose a public description. Open the source listing to review the solicitation."}</Typography>
            </Stack>
          </Box>
          <UsPursuitPanel tenderId={tender.id} />
        </Stack>
      </Container>
    </Box>
  );
}
