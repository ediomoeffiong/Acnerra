import React, { useState, useEffect } from "react";
import { AlertCircle, User, FileText, Image as ImageIcon, Check } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user, updateUser } = useAuth();
  
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [image, setImage] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isPending, setIsPending] = useState(false);

  // Initialize fields on open
  useEffect(() => {
    if (isOpen && user) {
      setName(user.name || "");
      setUsername(user.username || "");
      setBio(user.bio || "");
      setImage(user.image || "");
      setError(null);
      setFieldErrors({});
    }
  }, [isOpen, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    setError(null);
    setFieldErrors({});

    // Client-side validations before submit
    if (username.length < 3) {
      setFieldErrors({ username: ["Username must be at least 3 characters."] });
      setIsPending(false);
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setFieldErrors({ username: ["Username can only contain alphanumeric characters and underscores."] });
      setIsPending(false);
      return;
    }

    try {
      const response = await api.put("/profiles/me", {
        name: name.trim() || null,
        username: username.trim(),
        bio: bio.trim() || null,
        image: image.trim() || null,
      });

      // Update auth context immediately
      updateUser(response.data.user);
      
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err: any) {
      if (err.response?.data?.errors) {
        setFieldErrors(err.response.data.errors);
      } else if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit User Profile" className="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-5">
        
        {/* Profile Avatar Live Preview */}
        <div className="flex flex-col items-center justify-center gap-2 mb-2">
          <div className="relative group">
            {image.trim() ? (
              <img
                src={image}
                alt="Avatar Preview"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "";
                  setImage("");
                }}
                className="h-20 w-20 rounded-xl object-cover border border-zinc-800 bg-zinc-900 shadow-md transition-all duration-300"
              />
            ) : (
              <div className="h-20 w-20 rounded-xl bg-zinc-900 border border-zinc-800 text-3xl font-extrabold text-indigo-400 flex items-center justify-center shadow-lg shadow-black/40">
                {name ? name[0].toUpperCase() : username ? username[0].toUpperCase() : <User className="h-8 w-8 text-zinc-600" />}
              </div>
            )}
          </div>
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Live Avatar Preview</span>
        </div>

        {/* Display Name Input */}
        <Input
          id="name"
          name="name"
          label="Display Name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={fieldErrors?.name?.[0]}
          placeholder="e.g. John Doe"
        />

        {/* Username Input */}
        <Input
          id="username"
          name="username"
          label="Username"
          type="text"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          error={fieldErrors?.username?.[0]}
          placeholder="e.g. johndoe"
          helperText="3-20 characters. Alphanumeric & underscores only."
        />

        {/* Bio Text Area */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-zinc-500" />
            Short Bio
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            maxLength={160}
            className="flex w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-zinc-600 focus:border-zinc-600"
            placeholder="Tell us about your accountability targets..."
          />
          <div className="flex justify-between items-center text-[10px] text-zinc-500">
            <span>Empty fields are handled gracefully.</span>
            <span>{bio.length}/160</span>
          </div>
        </div>

        {/* Image URL Input */}
        <Input
          id="image"
          name="image"
          label="Avatar Image URL"
          type="url"
          value={image}
          onChange={(e) => setImage(e.target.value)}
          error={fieldErrors?.image?.[0]}
          placeholder="e.g. https://images.unsplash.com/photo-..."
          helperText="Link an image URL (optional)."
        />

        {/* Global Error Banner */}
        {error ? (
          <div className="flex items-center gap-2.5 p-3 text-xs text-red-400 bg-red-950/20 border border-red-900/30 rounded-lg">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p className="font-medium">{error}</p>
          </div>
        ) : null}

        {/* Submit Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-zinc-900">
          <Button type="button" variant="outline" onClick={onClose} size="sm">
            Cancel
          </Button>
          <Button type="submit" loading={isPending} size="sm" className="font-semibold gap-1.5">
            <Check className="h-4 w-4" /> Save Profile
          </Button>
        </div>
      </form>
    </Modal>
  );
};
