"use client";

import { useState } from "react";
import {
  Box,
  Button,
  Avatar,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import { LogOut, User, KeyRound } from "lucide-react";
import { useSession, authClient } from "@/lib/auth-client";

interface UserMenuProps {
  onOpenAuth: () => void;
}

export function UserMenu({ onOpenAuth }: UserMenuProps) {
  const { data: session, isPending } = useSession();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

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
      <Box
        onClick={handleMenuOpen}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          cursor: "pointer",
          borderRadius: 2,
          px: 1.5,
          py: 0.5,
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
      </Box>

      <Menu
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
