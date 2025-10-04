// Bookmark utilities for managing saved pizzerias

export interface BookmarkedLocation {
  pizzeriaName: string;
  city: string;
  locationIndex: number;
  address: string | null;
  lat: number;
  lng: number;
  url: string;
  bookmarkedAt: string;
}

const BOOKMARKS_KEY = '50toppizza_bookmarks';

export const getBookmarks = (): BookmarkedLocation[] => {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(BOOKMARKS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error loading bookmarks:', error);
    return [];
  }
};

export const saveBookmarks = (bookmarks: BookmarkedLocation[]): void => {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
  } catch (error) {
    console.error('Error saving bookmarks:', error);
  }
};

export const addBookmark = (location: Omit<BookmarkedLocation, 'bookmarkedAt'>): BookmarkedLocation[] => {
  const bookmarks = getBookmarks();
  const newBookmark: BookmarkedLocation = {
    ...location,
    bookmarkedAt: new Date().toISOString()
  };

  // Check if already bookmarked
  const exists = bookmarks.some(
    b => b.pizzeriaName === location.pizzeriaName &&
         b.city === location.city &&
         b.locationIndex === location.locationIndex
  );

  if (!exists) {
    const updatedBookmarks = [...bookmarks, newBookmark];
    saveBookmarks(updatedBookmarks);
    return updatedBookmarks;
  }

  return bookmarks;
};

export const removeBookmark = (pizzeriaName: string, city: string, locationIndex: number): BookmarkedLocation[] => {
  const bookmarks = getBookmarks();
  const updatedBookmarks = bookmarks.filter(
    b => !(b.pizzeriaName === pizzeriaName && b.city === city && b.locationIndex === locationIndex)
  );
  saveBookmarks(updatedBookmarks);
  return updatedBookmarks;
};

export const isBookmarked = (pizzeriaName: string, city: string, locationIndex: number): boolean => {
  const bookmarks = getBookmarks();
  return bookmarks.some(
    b => b.pizzeriaName === pizzeriaName && b.city === city && b.locationIndex === locationIndex
  );
};

export const toggleBookmark = (location: Omit<BookmarkedLocation, 'bookmarkedAt'>): {
  bookmarks: BookmarkedLocation[],
  isBookmarked: boolean
} => {
  if (isBookmarked(location.pizzeriaName, location.city, location.locationIndex)) {
    const bookmarks = removeBookmark(location.pizzeriaName, location.city, location.locationIndex);
    return { bookmarks, isBookmarked: false };
  } else {
    const bookmarks = addBookmark(location);
    return { bookmarks, isBookmarked: true };
  }
};
