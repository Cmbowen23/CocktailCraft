import { base44 } from './base44Client';
import { supabase } from '@/lib/supabase';

export const InvokeLLM = base44.integrations.InvokeLLM;

export const Core = {
  InvokeLLM: base44.integrations.InvokeLLM,

  SendEmail: async (to, subject, body) => {
    console.log('Mock Email Sent:', { to, subject, body });
    return { success: true, message: 'Email logged to console' };
  },

  UploadFile: async (file, bucket = 'uploads', path = null) => {
    try {
      if (!path) {
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        path = `${timestamp}_${safeName}`;
      }

      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false
        });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);
      return { path: data.path, url: publicUrl };
    } catch (error) {
      console.error('Upload failed:', error);
      throw error;
    }
  },

  GenerateImage: async (prompt) => {
    console.log('Generate Image requested:', prompt);
    return { url: 'https://placehold.co/1024x1024?text=AI+Image' };
  },

  ExtractDataFromUploadedFile: async () => {
    throw new Error('ExtractDataFromUploadedFile not implemented');
  },

  CreateFileSignedUrl: async () => {
    throw new Error('CreateFileSignedUrl not implemented');
  },

  UploadPrivateFile: async () => {
    throw new Error('UploadPrivateFile not implemented');
  },
};

export const SendEmail = Core.SendEmail;
export const UploadFile = Core.UploadFile;
export const GenerateImage = Core.GenerateImage;
export const ExtractDataFromUploadedFile = Core.ExtractDataFromUploadedFile;
export const CreateFileSignedUrl = Core.CreateFileSignedUrl;
export const UploadPrivateFile = Core.UploadPrivateFile;






