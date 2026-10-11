export type WishStatus = 'pending' | 'approved' | 'rejected';
export type Wish = {
  id: string;
  name: string;
  location: string | null;
  message: string;
  photo_url: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  file_size_bytes: number;
  status: WishStatus;
  created_at: string;
};
