/**
 * How many miniatures a book page sends with its HTML; the rest load on "show all".
 * Kept out of ArtworkGallery: a constant exported from a 'use client' module reaches a server
 * component as a client reference, not a number (slice(0, it) gave an empty gallery).
 */
export const GALLERY_FIRST = 24;
