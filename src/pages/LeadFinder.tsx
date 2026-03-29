const handleSearch = (e: React.FormEvent) => {
  e.preventDefault();
  setIsSearching(true);
  
  // Simulate API delay
  setTimeout(() => {
    const mockResults: SearchResult[] = Array.from({ length: 8 }).map((_, i) => {
      const hasWebsite = Math.random() > 0.4;
      const outdated = hasWebsite && Math.random() > 0.7;
      const rating = (3 + Math.random() * 2).toFixed(1);
      
      return {
        businessName: `${searchParams.category || 'Business'} ${i + 1}`,
        address: `${100 + i} Main St, ${searchParams.city || 'City'}`,
        phone: `(555) ${100 + i}-${2000 + i}`,
        website: hasWebsite ? `https://business${i}.com` : undefined,
        outdatedWebsite: outdated,
        rating: parseFloat(rating),
        reviewCount: Math.floor(Math.random() * 100),
        mapLink: 'https://maps.google.com'
      };
    });
    setResults(mockResults);
    setIsSearching(false);
  }, 1500);
};
