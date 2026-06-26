/**
 * Design Philosophy: German Functionalism with Modern Touch
 * - Prussian Blue (#1E3A5F) for authority and trust
 * - Amber (#D4A574) for accents and CTAs
 * - Asymmetric grid layouts with clear vertical rhythms
 * - IBM Plex Sans for headings, Inter for body text
 * - Subtle animations (200-300ms) for orientation
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { categories, getCategoryStats, getLocationStats, locations, tenders, type Tender } from "@/data/tenders";
import { Building2, Calendar, FileText, MapPin, Search, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Alle Kategorien");
  const [selectedLocation, setSelectedLocation] = useState("Alle Standorte");

  const filteredTenders = useMemo(() => {
    return tenders.filter((tender) => {
      const matchesSearch = 
        tender.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tender.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tender.description?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = 
        selectedCategory === "Alle Kategorien" || 
        tender.category.includes(selectedCategory);
      
      const matchesLocation = 
        selectedLocation === "Alle Standorte" || 
        tender.location.includes(selectedLocation);
      
      return matchesSearch && matchesCategory && matchesLocation;
    });
  }, [searchQuery, selectedCategory, selectedLocation]);

  const categoryData = getCategoryStats();
  const locationData = getLocationStats();

  const COLORS = [
    'oklch(0.55 0.12 250)',
    'oklch(0.45 0.12 250)',
    'oklch(0.35 0.12 250)',
    'oklch(0.72 0.08 65)',
    'oklch(0.62 0.08 65)',
    'oklch(0.52 0.08 65)'
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'url(/images/hero-architecture.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        />
        <div className="container relative py-16 md:py-24">
          <div className="max-w-3xl">
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Aktuelle Ausschreibungen für Immobilienverwaltungen
            </h1>
            <p className="text-lg md:text-xl text-primary-foreground/90 mb-8 leading-relaxed">
              Übersicht über {tenders.length} aktuelle öffentliche Ausschreibungen im Bereich Immobilienverwaltung und technisches Gebäudemanagement in Deutschland
            </p>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2 bg-primary-foreground/10 px-4 py-2 rounded-lg backdrop-blur-sm">
                <Calendar className="h-5 w-5" />
                <span className="font-medium">Januar 2026</span>
              </div>
              <div className="flex items-center gap-2 bg-primary-foreground/10 px-4 py-2 rounded-lg backdrop-blur-sm">
                <Building2 className="h-5 w-5" />
                <span className="font-medium">{tenders.length} Ausschreibungen</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Statistics Section */}
      <section className="py-12 bg-secondary/30">
        <div className="container">
          <div className="grid grid-cols-1 gap-8">
            {/* Category Distribution */}
            <Card className="geometric-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Verteilung nach Kategorien
                </CardTitle>
                <CardDescription>Anzahl der Ausschreibungen pro Kategorie</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Search and Filter Section */}
      <section className="py-12">
        <div className="container">
          <div className="mb-8">
            <h2 className="font-display text-3xl font-bold mb-4">Ausschreibungen durchsuchen</h2>
            <p className="text-muted-foreground">Filtern Sie nach Kategorie, Standort oder Suchbegriff</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Suche nach Titel, Auftraggeber..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Kategorie wählen" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
              <SelectTrigger>
                <SelectValue placeholder="Standort wählen" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((location) => (
                  <SelectItem key={location} value={location}>
                    {location}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="mb-4 text-sm text-muted-foreground">
            {filteredTenders.length} von {tenders.length} Ausschreibungen
          </div>

          {/* Tender Cards */}
          <div className="grid grid-cols-1 gap-6">
            {filteredTenders.map((tender) => (
              <TenderCard key={tender.id} tender={tender} />
            ))}
          </div>

          {filteredTenders.length === 0 && (
            <Card className="geometric-shadow">
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium mb-2">Keine Ausschreibungen gefunden</p>
                <p className="text-muted-foreground">Versuchen Sie andere Filterkriterien</p>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 mt-12">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="font-display font-semibold mb-3">Über diese Plattform</h3>
              <p className="text-sm text-muted-foreground">
                Aktuelle Übersicht öffentlicher Ausschreibungen im Bereich Immobilienverwaltung und technisches Gebäudemanagement
              </p>
            </div>
            <div>
              <h3 className="font-display font-semibold mb-3">Quellen</h3>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>BIM Berliner Immobilienmanagement</li>
                <li>Bundesanstalt für Immobilienaufgaben</li>
                <li>DTAD Ausschreibungsdatenbank</li>
                <li>TED - Tenders Electronic Daily</li>
              </ul>
            </div>
            <div>
              <h3 className="font-display font-semibold mb-3">Stand der Daten</h3>
              <p className="text-sm text-muted-foreground">
                Januar 2026<br />
                Alle Angaben ohne Gewähr
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function TenderCard({ tender }: { tender: Tender }) {
  return (
    <Card className="geometric-shadow hover:geometric-shadow-lg transition-all duration-300 hover:-translate-y-1">
      <CardHeader>
        <div className="flex items-start justify-between gap-4 mb-2">
          <div className="flex-1">
            <CardTitle className="text-xl mb-2">{tender.title}</CardTitle>
            <CardDescription className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              {tender.client}
            </CardDescription>
          </div>
          <Badge variant="secondary" className="shrink-0">
            {tender.category}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {tender.description && (
            <p className="text-sm text-foreground/80">{tender.description}</p>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-border">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{tender.location}</span>
            </div>
            
            {tender.deadline && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>Frist: {tender.deadline}</span>
              </div>
            )}
            
            {tender.referenceNumber && (
              <div className="flex items-center gap-2 text-sm font-mono">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span>{tender.referenceNumber}</span>
              </div>
            )}
            
            {tender.area && (
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span>Fläche: {tender.area}</span>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-border flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Quelle: {tender.source}
            </span>
            {tender.searchUrl && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.open(tender.searchUrl, '_blank')}
              >
                Details ansehen
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
