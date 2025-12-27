import { base44 } from './base44Client';

export const InvokeLLM = base44.integrations.InvokeLLM;

export const Core = {
  InvokeLLM: base44.integrations.InvokeLLM,
  SendEmail: async () => { throw new Error('SendEmail not implemented') },
  UploadFile: async () => { throw new Error('UploadFile not implemented') },
  GenerateImage: async () => { throw new Error('GenerateImage not implemented') },
  ExtractDataFromUploadedFile: async () => { throw new Error('ExtractDataFromUploadedFile not implemented') },
  CreateFileSignedUrl: async () => { throw new Error('CreateFileSignedUrl not implemented') },
  UploadPrivateFile: async () => { throw new Error('UploadPrivateFile not implemented') },
};

export const SendEmail = Core.SendEmail;
export const UploadFile = Core.UploadFile;
export const GenerateImage = Core.GenerateImage;
export const ExtractDataFromUploadedFile = Core.ExtractDataFromUploadedFile;
export const CreateFileSignedUrl = Core.CreateFileSignedUrl;
export const UploadPrivateFile = Core.UploadPrivateFile;






