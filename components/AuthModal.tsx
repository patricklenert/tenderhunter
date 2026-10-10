"use client";

import { useState, useCallback } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  IconButton,
  InputAdornment,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  Divider,
} from "@mui/material";
import { Eye, EyeOff, X, Mail, Lock, KeyRound } from "lucide-react";
import { authClient } from "@/lib/auth-client";

type AuthTab = "login" | "register";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  defaultTab?: AuthTab;
  onSuccess?: () => void;
}

export function AuthModal({ open, onClose, defaultTab = "login", onSuccess }: AuthModalProps) {
  const [tab, setTab] = useState<AuthTab>(defaultTab);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const resetForm = useCallback(() => {
    setEmail("");
    setPassword("");
    setName("");
    setShowPassword(false);
    setError(null);
  }, []);

  const handleTabChange = (_: React.SyntheticEvent, value: AuthTab) => {
    setTab(value);
    resetForm();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (tab === "register") {
        const res = await authClient.signUp.email({
          email,
          password,
          name,
        });
        if (res.error) {
          setError(res.error.message ?? "Registrierung fehlgeschlagen.");
        } else {
          onSuccess?.();
          handleClose();
          window.location.reload();
        }
      } else {
        const res = await authClient.signIn.email({
          email,
          password,
        });
        if (res.error) {
          setError(res.error.message ?? "Anmeldung fehlgeschlagen.");
        } else {
          onSuccess?.();
          handleClose();
          window.location.reload();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google-Anmeldung fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeySignIn = async () => {
    setError(null);
    setLoading(true);

    try {
      const res = await authClient.signIn.passkey();
      if (res.error) {
        setError(res.error.message ?? "Passkey-Anmeldung fehlgeschlagen.");
      } else {
        onSuccess?.();
        handleClose();
        window.location.reload();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Passkey-Anmeldung fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.15)",
          overflow: "hidden",
        },
      }}
    >
      <Box sx={{ position: "relative" }}>
        {/* Close button */}
        <IconButton
          onClick={handleClose}
          aria-label="Dialog schließen"
          sx={{
            position: "absolute",
            top: 12,
            right: 12,
            zIndex: 1,
            color: "text.secondary",
            "&:hover": { color: "text.primary", bgcolor: "action.hover" },
          }}
          size="small"
        >
          <X size={18} />
        </IconButton>

        {/* Header */}
        <Box sx={{ px: 4, pt: 4, pb: 1, textAlign: "center" }}>
          <Typography variant="h5" fontWeight={700} sx={{ color: "text.primary", mb: 0.5 }}>
            {tab === "login" ? "Willkommen zurück" : "Konto erstellen"}
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {tab === "login"
              ? "Melden Sie sich an, um Ausschreibungen zu suchen"
              : "Registrieren Sie sich, um zu starten"}
          </Typography>
        </Box>

        {/* Tabs */}
        <Box sx={{ px: 4, pb: 2 }}>
          <Tabs
            value={tab}
            onChange={handleTabChange}
            variant="fullWidth"
            sx={{
              minHeight: 40,
              "& .MuiTabs-flexContainer": { gap: 0 },
              "& .MuiTabs-indicator": {
                height: 2,
                bgcolor: "primary.main",
              },
            }}
          >
            <Tab
              label="Anmelden"
              value="login"
              sx={{
                textTransform: "none",
                fontWeight: 600,
                fontSize: 14,
                minHeight: 40,
                color: "text.secondary",
                "&.Mui-selected": { color: "text.primary" },
              }}
            />
            <Tab
              label="Registrieren"
              value="register"
              sx={{
                textTransform: "none",
                fontWeight: 600,
                fontSize: 14,
                minHeight: 40,
                color: "text.secondary",
                "&.Mui-selected": { color: "text.primary" },
              }}
            />
          </Tabs>
        </Box>

        <Divider sx={{ mx: 4 }} />

        {/* Form */}
        <DialogContent sx={{ px: 4, py: 3 }}>
          <Stack component="form" onSubmit={handleEmailAuth} spacing={2.5}>
            {tab === "register" && (
              <TextField
                label="Name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                fullWidth
                size="medium"
                placeholder="Max Mustermann"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Mail size={20} color="currentColor" />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 2.5,
                    bgcolor: "background.default",
                    fontSize: "1.05rem",
                  },
                  "& .MuiInputLabel-root": {
                    fontSize: "1.05rem",
                  },
                }}
              />
            )}

            <TextField
              label="E-Mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
              size="medium"
              placeholder="name@firma.de"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Mail size={20} color="currentColor" />
                  </InputAdornment>
                ),
              }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: 2.5,
                  bgcolor: "background.default",
                  fontSize: "1.05rem",
                },
                "& .MuiInputLabel-root": {
                  fontSize: "1.05rem",
                },
              }}
            />

            <TextField
              label="Passwort"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
              size="medium"
              placeholder="••••••••"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock size={20} color="currentColor" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword((p) => !p)}
                      edge="end"
                      size="small"
                      aria-label={showPassword ? "Passwort verbergen" : "Passwort anzeigen"}
                      sx={{ color: "text.secondary" }}
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: 2.5,
                  bgcolor: "background.default",
                  fontSize: "1.05rem",
                },
                "& .MuiInputLabel-root": {
                  fontSize: "1.05rem",
                },
              }}
            />

            {error && (
              <Typography variant="body2" sx={{ color: "error.main", textAlign: "center", fontWeight: 500 }}>
                {error}
              </Typography>
            )}

            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={loading}
              sx={{
                py: 1.8,
                borderRadius: 2.5,
                fontWeight: 700,
                fontSize: "1.05rem",
                textTransform: "none",
              }}
            >
              {loading
                ? "Bitte warten..."
                : tab === "login"
                ? "Anmelden"
                : "Konto erstellen"}
            </Button>
          </Stack>

          {/* Divider */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, my: 2.5 }}>
            <Divider sx={{ flex: 1 }} />
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 500 }}>
              oder
            </Typography>
            <Divider sx={{ flex: 1 }} />
          </Box>

          {/* Social / Passkey buttons */}
          <Stack spacing={1.5}>
            <Button
              variant="outlined"
              fullWidth
              onClick={handleGoogleSignIn}
              disabled={loading}
              size="large"
              startIcon={
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              }
              sx={{
                py: 1.5,
                borderRadius: 2.5,
                fontWeight: 600,
                fontSize: "1rem",
                textTransform: "none",
                borderColor: "divider",
                color: "text.primary",
                "&:hover": { borderColor: "text.secondary", bgcolor: "action.hover" },
              }}
            >
              Mit Google fortfahren
            </Button>

            {tab === "login" && (
              <Button
                variant="outlined"
                fullWidth
                onClick={handlePasskeySignIn}
                disabled={loading}
                size="large"
                startIcon={<KeyRound size={20} />}
                sx={{
                  py: 1.5,
                  borderRadius: 2.5,
                  fontWeight: 600,
                  fontSize: "1rem",
                  textTransform: "none",
                  borderColor: "divider",
                  color: "text.primary",
                  "&:hover": { borderColor: "text.secondary", bgcolor: "action.hover" },
                }}
              >
                Mit Passkey anmelden
              </Button>
            )}
          </Stack>
        </DialogContent>
      </Box>
    </Dialog>
  );
}
