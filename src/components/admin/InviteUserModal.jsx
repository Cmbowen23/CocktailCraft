import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const InviteUserModal = ({
  isOpen,
  onClose,
  onSuccess,
  allAccounts = [],
}) => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [role, setRole] = useState("user");
  const [userType, setUserType] = useState("internal");
  const [accountId, setAccountId] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  if (!isOpen) return null;

  const resetState = () => {
    setFullName("");
    setEmail("");
    setCompanyName("");
    setRole("user");
    setUserType("internal");
    setAccountId("");
    setErrorMsg("");
    setSuccessMsg("");
    setInviteLink("");
    setCopyStatus("");
  };

  const closeModal = () => {
    resetState();
    onClose && onClose();
  };

  const sendInvite = async (sendEmailFlag = true) => {
    setErrorMsg("");
    setSuccessMsg("");
    setInviteLink("");
    setCopyStatus("");

    if (!email) {
      setErrorMsg("Email is required.");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        full_name: fullName,
        email,
        company_name: companyName,
        role,
        user_type: userType,
        account_id: accountId || "",
        assigned_account_ids: [],
        buyer_menu_access: [],
        account_csv_data: null,
        send_email: sendEmailFlag,
      };

      // Use base44 SDK to handle auth automatically
      const res = await base44.functions.invoke("sendUserInvitation", payload);
      const data = res.data;

      const inviteUrl = (data && data.inviteUrl) || "";
      const message = (data && data.message) || "";

      // Only show banner when we actually sent an email
      if (sendEmailFlag) {
        setSuccessMsg(message || "Invitation created and email sent.");
      }

      if (inviteUrl) {
        setInviteLink(inviteUrl); // link + QR shows below
      }

      // Only bubble up success for email sends (avoids extra prompts for link-only)
      if (onSuccess && sendEmailFlag) {
        onSuccess({ inviteUrl, email, full_name: fullName });
      }
    } catch (err) {
      const msg =
        err && err.message ? err.message : "Failed to send invitation.";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopyStatus("Copied!");
      setTimeout(() => setCopyStatus(""), 1500);
    } catch {
      setCopyStatus("Copy failed");
      setTimeout(() => setCopyStatus(""), 1500);
    }
  };

  // QR image URL (no extra libraries)
  const qrUrl = inviteLink
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
        inviteLink
      )}`
    : "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      style={{ backdropFilter: "blur(2px)" }}
    >
      <div className="w-full max-w-lg rounded-md bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Invite New User</h2>
          <button
            type="button"
            onClick={closeModal}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {/* Name + Email */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Full Name
              </label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Kayla Smith"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Email *
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="kayla@fedway.com"
              />
            </div>
          </div>

          {/* Company */}
          <div>
            <label className="mb-1 block text-sm font-medium">
              Company Name
            </label>
            <Input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Fedway / CocktailCraft"
            />
          </div>

          {/* Role + User Type */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">
                System Role
              </label>
              <select
                className="w-full rounded border px-2 py-1 text-sm"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                User Type
              </label>
              <select
                className="w-full rounded border px-2 py-1 text-sm"
                value={userType}
                onChange={(e) => setUserType(e.target.value)}
              >
                <option value="internal">Internal</option>
                <option value="buyer_admin">Buyer Admin</option>
                <option value="sales_rep">Sales Rep</option>
                <option value="on_premise">On Premise</option>
              </select>
            </div>
          </div>

          {/* Primary Account */}
          <div>
            <label className="mb-1 block text-sm font-medium">
              Primary Account (optional)
            </label>
            <select
              className="w-full rounded border px-2 py-1 text-sm"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              <option value="">None</option>
              {allAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </div>

          {/* Error */}
          {errorMsg && (
            <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMsg}
            </div>
          )}

          {/* Success (email sends only) */}
          {successMsg && (
            <div className="rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
              {successMsg}
            </div>
          )}

          {/* Invite link + QR */}
          {inviteLink && (
            <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm">
              <div className="mb-1 font-medium">Invite Link</div>
              <div className="break-all text-xs">{inviteLink}</div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  onClick={handleCopyLink}
                  className="h-7 px-3 text-xs"
                >
                  Copy Link
                </Button>
                {copyStatus && (
                  <span className="text-xs text-gray-600">
                    {copyStatus}
                  </span>
                )}
              </div>

              {qrUrl && (
                <div className="mt-3 flex justify-center">
                  <div className="rounded-md bg-white p-3 shadow-sm">
                    <img
                      src={qrUrl}
                      alt="QR Code"
                      className="w-40 h-40"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer buttons */}
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={closeModal} disabled={loading}>
              Cancel
            </Button>

            <Button
              variant="outline"
              onClick={() => sendInvite(false)}
              disabled={loading}
            >
              {loading ? "Working..." : "Generate Link (no email)"}
            </Button>

            <Button onClick={() => sendInvite(true)} disabled={loading}>
              {loading ? "Sending..." : "Send Invitation Email"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InviteUserModal;