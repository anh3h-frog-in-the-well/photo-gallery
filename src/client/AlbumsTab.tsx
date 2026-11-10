"use client";

import CreateAlbum from "./CreateAlbum";
import ShowAlbum from "./ShowAlbum";
import type { Album } from "../interface/album";
import type { GalleryImage } from "../interface/image";

type AlbumsTabProps = {
  albums: Album[];
  images: GalleryImage[];
  isLoading: boolean;
  onAlbumCreated: (album: Album) => void;
  onAlbumUpdated: (album: Album) => void;
};

export default function AlbumsTab({
  albums,
  images,
  isLoading,
  onAlbumCreated,
  onAlbumUpdated,
}: AlbumsTabProps) {
  return (
    <section className="mt-10" aria-labelledby="albums-heading">
      <ShowAlbum
        albums={albums}
        images={images}
        isLoading={isLoading}
        onAlbumUpdated={onAlbumUpdated}
      />
      <div className="mt-8">
        <CreateAlbum
          images={images}
          isLoading={isLoading}
          onAlbumCreated={onAlbumCreated}
        />
      </div>
    </section>
  );
}
