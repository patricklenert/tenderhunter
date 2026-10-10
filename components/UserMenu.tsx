"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Avatar,
  ButtonBase,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import { CreditCard, LogOut, User, KeyRound } from "lucide-react";
import { useSession, authClient } from "@/lib/auth-client";

interface UserMenuProps {
  onOpenAuth: () => void;
}

export function UserMenu({ onOpenAuth }: UserMenuProps) {
  const { data: session, isPending } = useSession();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [billingActive, setBillingActive] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);

  useEffect(() => {
    if (!session?.user?.id) {
      setBillingActive(false);
      return;
    }

    let cancelled = false;
    void fetch("/api/billing/status", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<{ active?: boolean }> : { active: false })
      .then((status) => {
        if (!cancelled) setBillingActive(status.active === true);
      })
      .catch(() => {
        if (!cancelled) setBillingActive(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleSignOut = async () => {
    await authClient.signOut();
    handleMenuClose();
    window.location.reload();
  };

  const handleAddPasskey = async () => {
    handleMenuClose();
    try {
      const res = await (authClient as any).passkey.addPasskey({ name: "Tenderhunter Account" });
      if (res?.error) {
        alert(`Passkey-Fehler: ${res.error.message ?? res.error.code ?? "Unbekannter Fehler"}`);
      } else {
        alert("Passkey erfolgreich hinzugefügt!");
      }
    } catch (err) {
      alert(`Passkey-Fehler: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleBilling = async () => {
    handleMenuClose();
    if (!billingActive) {
      window.location.assign("/upgrade");
      return;
    }

    setBillingLoading(true);
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const payload = await response.json() as { url?: string };
      if (response.ok && payload.url) window.location.assign(payload.url);
      else window.location.assign("/upgrade");
    } catch {
      window.location.assign("/upgrade");
    } finally {
      setBillingLoading(false);
    }
  };

  if (isPending) {
    return (
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          bgcolor: "action.hover",
          animation: "pulse 1.5s ease-in-out infinite",
          "@keyframes pulse": {
            "0%, 100%": { opacity: 1 },
            "50%": { opacity: 0.5 },
          },
        }}
      />
    );
  }

  if (!session?.user) {
    return (
      <Button
        variant="outlined"
        size="small"
        onClick={onOpenAuth}
        startIcon={<User size={16} />}
        sx={{
          borderRadius: 2,
          fontWeight: 600,
          textTransform: "none",
          fontSize: 14,
          borderColor: "divider",
          color: "text.primary",
          "&:hover": { borderColor: "text.secondary", bgcolor: "action.hover" },
        }}
      >
        Anmelden
      </Button>
    );
  }

  const user = session.user;
  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : user.email?.slice(0, 2).toUpperCase() ?? "?";

  return (
    <>
      <ButtonBase
        id="user-menu-trigger"
        onClick={handleMenuOpen}
        aria-label="Benutzermenü öffnen"
        aria-haspopup="menu"
        aria-expanded={Boolean(anchorEl)}
        aria-controls={anchorEl ? "user-menu" : undefined}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          minHeight: 44,
          borderRadius: 2,
          px: 1.5,
          py: 0.5,
          color: "inherit",
          textAlign: "left",
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        <Avatar
          sx={{
            width: 32,
            height: 32,
            bgcolor: "primary.main",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {initials}
        </Avatar>
        <Box sx={{ display: { xs: "none", sm: "block" } }}>
          <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 140 }}>
            {user.name ?? user.email}
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {user.email}
          </Typography>
        </Box>
      </ButtonBase>

      <Menu
        id="user-menu"
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: {
            mt: 1,
            minWidth: 180,
            borderRadius: 2,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          },
        }}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
      >
        <MenuItem onClick={() => void handleBilling()} disabled={billingLoading} sx={{ borderRadius: 1, mx: 0.5, my: 0.25 }}>
          <ListItemIcon>
            <CreditCard size={16} />
          </ListItemIcon>
          <ListItemText primary={billingActive ? "Billing verwalten" : "Upgrade"} primaryTypographyProps={{ fontSize: 14, fontWeight: 500 }} />
        </MenuItem>
        <MenuItem onClick={handleAddPasskey} sx={{ borderRadius: 1, mx: 0.5, my: 0.25 }}>
          <ListItemIcon>
            <KeyRound size={16} />
          </ListItemIcon>
          <ListItemText primary="Passkey hinzufügen" primaryTypographyProps={{ fontSize: 14, fontWeight: 500 }} />
        </MenuItem>
        <MenuItem onClick={handleSignOut} sx={{ borderRadius: 1, mx: 0.5, my: 0.25 }}>
          <ListItemIcon>
            <LogOut size={16} />
          </ListItemIcon>
          <ListItemText primary="Abmelden" primaryTypographyProps={{ fontSize: 14, fontWeight: 500 }} />
        </MenuItem>
      </Menu>
    </>
  );
}
