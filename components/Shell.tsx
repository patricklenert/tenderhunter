"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  Menu as MenuIcon,
  BriefcaseBusiness,
  Globe2,
  Radar,
  Bot,
} from "lucide-react";
import { SearchLocationIcon } from "@/components/icons/SidebarIcons";
import { BrandLockup } from "@/components/BrandLockup";
import { AuthModal } from "@/components/AuthModal";
import { UserMenu } from "@/components/UserMenu";
import Link from "next/link";

export type ViewKey =
  | "discovery"
  | "trackedTenders"
  | "publicTenders"
  | "usOpportunities"
  | "mcp";

export interface NavItem {
  key: ViewKey;
  label: string;
  icon: React.ElementType;
}

export const NAV_ITEMS: NavItem[] = [
  { key: "discovery", label: "Analyse", icon: Radar },
  { key: "trackedTenders", label: "Verfolgte Ausschreibungen", icon: BriefcaseBusiness },
  { key: "publicTenders", label: "Ausschreibungen", icon: SearchLocationIcon },
  { key: "usOpportunities", label: "U.S. Opportunities", icon: Globe2 },
  { key: "mcp", label: "MCP", icon: Bot },
];

const HASH_TO_VIEW: Record<string, ViewKey> = {
  "ausschreibungen": "publicTenders",
  "analyse": "discovery",
  "verfolgt": "trackedTenders",
  "us": "usOpportunities",
  "mcp": "mcp",
};

const VIEW_TO_HASH: Record<ViewKey, string> = {
  discovery: "analyse",
  trackedTenders: "verfolgt",
  publicTenders: "ausschreibungen",
  usOpportunities: "us",
  mcp: "mcp",
};

function getViewFromHash(): ViewKey | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.replace("#", "");
  return HASH_TO_VIEW[hash] ?? null;
}

const DRAWER_WIDTH = 260;

interface ShellProps {
  children: (
    currentView: ViewKey,
    setView: (view: ViewKey) => void,
    openAuth: (tab?: "login" | "register") => void
  ) => React.ReactNode;
}

export function Shell({ children }: ShellProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [currentView, setCurrentView] = useState<ViewKey>(() => getViewFromHash() ?? "discovery");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<"login" | "register">("login");
  const [hasTrackedTenders, setHasTrackedTenders] = useState(() => {
    if (typeof window !== "undefined") {
      return window.localStorage.getItem("tenderhunter:hasTrackedTenders") === "true";
    }
    return false;
  });

  useEffect(() => {
    const handleTracked = () => setHasTrackedTenders(true);
    window.addEventListener("tenderhunter:tracked", handleTracked);
    return () => window.removeEventListener("tenderhunter:tracked", handleTracked);
  }, []);

  const visibleNavItems = hasTrackedTenders ? NAV_ITEMS : NAV_ITEMS.filter((item) => item.key !== "trackedTenders");

  useEffect(() => {
    if (currentView === "trackedTenders" && !hasTrackedTenders) {
      setCurrentView("discovery");
    }
  }, [currentView, hasTrackedTenders]);

  useEffect(() => {
    const hash = VIEW_TO_HASH[currentView];
    if (hash && window.location.hash !== `#${hash}`) {
      window.history.replaceState(null, "", `#${hash}`);
    }
  }, [currentView]);

  useEffect(() => {
    const onHashChange = () => {
      const view = getViewFromHash();
      if (view) setCurrentView(view);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const currentLabel = visibleNavItems.find((item) => item.key === currentView)?.label ?? "Tenderhunter";

  const drawerContent = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Box
        component={Link}
        href="/"
        aria-label="Tenderhunter Startseite"
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          px: 2.5,
          height: { xs: 52, md: 64 },
          borderBottom: 1,
          borderColor: "divider",
          textDecoration: "none",
          color: "inherit",
          flexShrink: 0,
        }}
      >
        <BrandLockup size={40} labelSize={16} gap={12} />
      </Box>

      <Box id="main-navigation" component="nav" aria-label="Hauptnavigation" sx={{ flex: 1, px: 2, pt: 2 }}>
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const active = currentView === item.key;

          return (
            <Box key={item.key}>
              {item.key === "mcp" && <Divider sx={{ my: 1.5 }} />}
              <ListItemButton
                selected={active}
                aria-current={active ? "page" : undefined}
                onClick={() => {
                  setCurrentView(item.key);
                  setMobileOpen(false);
                }}
                sx={{
                  minHeight: 44,
                  border: "1px solid transparent",
                  borderRadius: 1.5,
                  mb: 0.5,
                  px: 1.25,
                  py: 1,
                  color: "text.primary",
                  "&.Mui-selected": {
                    bgcolor: "var(--color-brand-signal-soft)",
                    borderColor: "var(--color-brand-signal-border)",
                    color: "var(--color-brand-primary)",
                    "&:hover": { bgcolor: "var(--color-brand-signal-soft)" },
                  },
                  "&:not(.Mui-selected):hover": {
                    bgcolor: "var(--color-surface-strong)",
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: "inherit" }}>
                  <Icon size={20} color={active ? theme.palette.primary.dark : theme.palette.text.secondary} />
                </ListItemIcon>
                <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: active ? 700 : 600, fontSize: 15 }} />
              </ListItemButton>
            </Box>
          );
        })}
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {isMobile ? (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            "& .MuiDrawer-paper": {
              width: DRAWER_WIDTH,
              bgcolor: "background.paper",
            },
          }}
        >
          {drawerContent}
        </Drawer>
      ) : (
        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            "& .MuiDrawer-paper": {
              width: DRAWER_WIDTH,
              bgcolor: "background.paper",
              boxSizing: "border-box",
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
        }}
      >
        <AppBar
          position="static"
          elevation={0}
          sx={{
            bgcolor: "background.default",
          }}
        >
          <Toolbar disableGutters sx={{ color: "text.primary", minHeight: { xs: 52, md: 64 }, px: 2, borderBottom: 1, borderColor: "divider" }}>
            {isMobile && (
              <IconButton
                edge="start"
                onClick={() => setMobileOpen(true)}
                aria-label="Navigation öffnen"
                aria-controls="main-navigation"
                aria-expanded={mobileOpen}
                sx={{ ml: -0.5, mr: 1, color: "text.primary" }}
              >
                <MenuIcon size={20} />
              </IconButton>
            )}
            <Typography component="div" variant="h6" fontWeight={600} fontSize={18} noWrap color="text.primary" sx={{ flex: 1 }}>
              {currentLabel}
            </Typography>
            <UserMenu onOpenAuth={() => { setAuthModalTab("login"); setAuthModalOpen(true); }} />
          </Toolbar>
        </AppBar>

        <Box sx={{ flex: 1, overflowY: "auto", px: { xs: 2, md: 4 }, py: { xs: 2, md: 4 } }}>
          <Box sx={{ maxWidth: 1200, mx: "auto" }}>
            {children(currentView, setCurrentView, (tab = "login") => {
              setAuthModalTab(tab);
              setAuthModalOpen(true);
            })}
          </Box>
        </Box>
      </Box>

      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        defaultTab={authModalTab}
      />
    </Box>
  );
}
