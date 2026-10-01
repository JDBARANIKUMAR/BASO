import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, ArrowRight, RotateCw, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';
import Avatar from '../components/Avatar';

export const OnboardingPage = () => {
  const navigate = useNavigate();
  const { updateUser, user } = useAuth();

  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Handle local image upload as Data URL
  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError('Please select an image smaller than 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAvatar(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter your name.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/complete-profile', {
        name: trimmedName,
        avatar: avatar || '',
      });

      updateUser(res.user);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Failed to complete profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-black text-white flex flex-col justify-between p-6 sm:p-10 select-none">
      <div className="flex justify-center pt-6">
        <Logo size="md" />
      </div>

      <div className="w-full max-w-sm mx-auto my-auto py-8">
        <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
          Create profile
        </h1>
        <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
          Choose a name and optional photo so your friends can recognize you.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Avatar Upload */}
          <div className="flex flex-col items-center justify-center">
            <div className="relative group cursor-pointer">
              <Avatar name={name || 'User'} avatar={avatar} size="xl" />
              <label
                htmlFor="avatar-input"
                className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border border-zinc-500"
              >
                <Camera size={22} className="text-white" />
                <span className="text-[10px] text-white font-medium mt-1">Upload</span>
              </label>
              <input
                id="avatar-input"
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </div>
            <label
              htmlFor="avatar-input"
              className="text-xs text-zinc-400 hover:text-white mt-3 cursor-pointer underline underline-offset-4"
            >
              {avatar ? 'Change photo' : 'Add photo (optional)'}
            </label>
          </div>

          {/* Name Input */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              Full Name
            </label>
            <input
              type="text"
              autoFocus
              maxLength={50}
              placeholder="e.g. Alex Vance"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              className="w-full px-4 py-3.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-white transition-colors text-base"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-zinc-300">
              <AlertCircle size={15} className="shrink-0 text-white" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-white text-black font-semibold rounded-xl hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50"
          >
            {loading ? (
              <RotateCw size={18} className="animate-spin" />
            ) : (
              <>
                <span>Get Started</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      </div>

      <div className="text-center pb-4 text-xs text-zinc-600">
        Connected to mobile {user?.mobile}
      </div>
    </div>
  );
};

export default OnboardingPage;
