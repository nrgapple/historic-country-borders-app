import { NextApiHandler } from 'next';

/**
 * PA School Districts API
 * 
 * Due to the large size of the GeoJSON file (20MB), we serve it directly
 * from the public folder. The file will be processed on the client side
 * or can be accessed directly at /PaSchoolDistricts2025_10.geojson
 */
const handler: NextApiHandler = async (req, res) => {
  // Redirect to the static file in public folder
  // The client will fetch it directly and process it
  return res.status(200).json({
    url: '/PaSchoolDistricts2025_10.geojson',
    message: 'Use the static GeoJSON file directly from public folder'
  });
};

export default handler;

