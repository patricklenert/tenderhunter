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
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  Menu as MenuIcon,
  BriefcaseBusiness,
  Globe2,
  // Crosshair,  // Ursprüngliches Analyse-Icon (Lucide) — auskommentiert für Rollback
  // Building2,  // Ursprüngliches Ausschreibungen-Icon (Lucide) — auskommentiert für Rollback
} from "lucide-react";
import { AnalyseIcon, SearchLocationIcon } from "@/components/icons/SidebarIcons";
import { AuthModal } from "@/components/AuthModal";
import { UserMenu } from "@/components/UserMenu";
import Link from "next/link";

export type ViewKey =
  | "discovery"
  | "trackedTenders"
  | "publicTenders";

export interface NavItem {
  key: ViewKey;
  label: string;
  icon: React.ElementType;
}

export const NAV_ITEMS: NavItem[] = [
  // { key: "discovery", label: "Analyse", icon: Crosshair },  // Ursprüngliches Lucide-Icon — auskommentiert für Rollback
  { key: "discovery", label: "Analyse", icon: AnalyseIcon },
  { key: "trackedTenders", label: "Verfolgte Ausschreibungen", icon: BriefcaseBusiness },
  // { key: "publicTenders", label: "Ausschreibungen", icon: Building2 },  // Ursprüngliches Lucide-Icon — auskommentiert für Rollback
  { key: "publicTenders", label: "Ausschreibungen", icon: SearchLocationIcon },
];

const HASH_TO_VIEW: Record<string, ViewKey> = {
  "ausschreibungen": "publicTenders",
  "analyse": "discovery",
  "verfolgt": "trackedTenders",
};

const VIEW_TO_HASH: Record<ViewKey, string> = {
  discovery: "analyse",
  trackedTenders: "verfolgt",
  publicTenders: "ausschreibungen",
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
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 2,
            bgcolor: "primary.main",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <AnalyseIcon size={22} color="#fff" />
        </Box>
        <Typography variant="subtitle1" fontWeight={700} noWrap>
          Tenderhunter
        </Typography>
      </Box>

      <Box id="main-navigation" component="nav" aria-label="Hauptnavigation" sx={{ flex: 1, px: 2, pt: 2 }}>
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const active = currentView === item.key;

          return (
            <ListItemButton
              key={item.key}
              selected={active}
              onClick={() => {
                setCurrentView(item.key);
                setMobileOpen(false);
              }}
              sx={{
                borderRadius: 2,
                mb: 1,
                py: 1.5,
                color: "text.primary",
                "&.Mui-selected": {
                  bgcolor: "action.selected",
                  "&:hover": { bgcolor: "action.selected" },
                },
                "&:not(.Mui-selected):hover": {
                  bgcolor: "action.hover",
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 48 }}>
                <Icon size={24} color={theme.palette.text.secondary} />
              </ListItemIcon>
              <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: 600, fontSize: 16 }} />
            </ListItemButton>
          );
        })}
        <ListItemButton
          component="a"
          href="/us"
          onClick={() => setMobileOpen(false)}
          aria-label="U.S. Opportunities"
          sx={{
            borderRadius: 2,
            mb: 1,
            py: 1.5,
            color: "text.primary",
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          <ListItemIcon sx={{ minWidth: 48 }}>
            <Globe2 size={24} color={theme.palette.text.secondary} />
          </ListItemIcon>
          <ListItemText primary="U.S. Opportunities" primaryTypographyProps={{ fontWeight: 600, fontSize: 16 }} />
        </ListItemButton>
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
                aria-label="Open navigation"
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
