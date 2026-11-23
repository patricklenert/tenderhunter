export interface UsTeamingResource {
  title: string;
  organization: string;
  url: string;
  detail: string;
}

const GENERAL_RESOURCES: UsTeamingResource[] = [
  {
    title: "SBA subcontracting opportunities",
    organization: "U.S. Small Business Administration",
    url: "https://www.sba.gov/federal-contracting/contracting-guide/prime-subcontracting/subcontracting-opportunities",
    detail: "Aktuelle Unteraufträge von Hauptauftragnehmern mit Angaben zu den zuständigen Kontaktpersonen.",
  },
  {
    title: "GSA subcontracting directory",
    organization: "General Services Administration",
    url: "https://www.gsa.gov/small-business/find-opportunities/gsa-subcontracting-directory",
    detail: "Verzeichnis großer GSA-Hauptauftragnehmer mit hinterlegten Unterauftragsplänen und Leistungsbereichen.",
  },
  {
    title: "DoD comprehensive subcontracting plan participants",
    organization: "Department of Defense",
    url: "https://business.defense.gov/Acquisition/Subcontracting/DoD-CSP/",
    detail: "Übersicht teilnehmender Hauptauftragnehmer mit Kontakten für kleine Unternehmen, sofern verfügbar.",
  },
];

const DHS_RESOURCE: UsTeamingResource = {
  title: "DHS prime contractor directory",
  organization: "Department of Homeland Security",
  url: "https://www.dhs.gov/osdbu/prime-contractors",
  detail: "DHS-Verzeichnis mit Kontakten für kleine Unternehmen und ausgewiesenen NAICS-Bedarfen.",
};

export const getUsTeamingResources = (buyer: string | null): UsTeamingResource[] => {
  const resources = [...GENERAL_RESOURCES];
  if (/homeland security|\bdhs\b/i.test(buyer ?? "")) resources.unshift(DHS_RESOURCE);
  return resources;
};
