import PhotoDetailContent from "./_components/photo-detail-content";

export default function PhotoDetailPage({ params }: { params: { id: string } }) {
  return <PhotoDetailContent photoId={params?.id ?? ""} />;
}
