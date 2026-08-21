export interface AtlasBrand {
  name: string;
  cat: string;
}

export interface AtlasCountry {
  heading: string;
  description: string;
  brands: AtlasBrand[];
}

export interface AtlasCentroid {
  x: number;
  y: number;
}

/** Add a country by adding a "countries" entry keyed by its exact map name (see the
 * data-name attributes on the <path class="country"> elements in world-map-paths.svg).
 * "brands" can be an empty array if you don't have named houses for it yet — the
 * marker and description still appear. Give it a matching entry in "centroids" too,
 * so a pulsing marker renders over the right spot on the map. */
export const centroids: Record<string, AtlasCentroid> = {
  France: { x: 469.85, y: 115.02 },
  'United Kingdom': { x: 473.5, y: 78.51 },
  Italy: { x: 509.96, y: 112.4 },
  India: { x: 689.2, y: 174.55 },
  Japan: { x: 826.66, y: 128.36 },
};

export const countries: Record<string, AtlasCountry> = {
  France: {
    heading: 'The home of many of the maisons that shaped modern luxury.',
    description:
      "What interests me most about French luxury is the way heritage has been turned into something that can keep evolving.",
    brands: [
      { name: 'Louis Vuitton', cat: 'Leather Goods' },
      { name: 'Dior', cat: 'Fashion & Beauty' },
      { name: 'CHANEL', cat: 'Fashion' },
      { name: 'Hermès', cat: 'Leather Goods' },
      { name: 'Cartier', cat: 'Jewellery' },
    ],
  },
  Italy: {
    heading: 'Craft, design and a very different approach to luxury.',
    description: 'Italian maisons show how craftsmanship and creativity can become powerful brand assets.',
    brands: [
      { name: 'Prada', cat: 'Fashion' },
      { name: 'Bottega Veneta', cat: 'Leather Goods' },
      { name: 'Gucci', cat: 'Fashion' },
      { name: 'Bulgari', cat: 'Jewellery' },
    ],
  },
  India: {
    heading: "A culture with so much already built into its idea of luxury.",
    description:
      'India has craftsmanship, textiles, jewellery, ceremony, storytelling and incredibly diverse cultural traditions. I think there is a lot to explore here, especially as Indian luxury becomes increasingly relevant to the global conversation.',
    brands: [],
  },
  Japan: {
    heading: 'Precision, restraint and craftsmanship.',
    description: 'Japanese luxury offers a completely different way of thinking about quality and desirability.',
    brands: [],
  },
  'United Kingdom': {
    heading: 'Heritage that keeps finding new ways to express itself.',
    description: 'British luxury has a fascinating relationship with history, tradition and contemporary culture.',
    brands: [],
  },
};
