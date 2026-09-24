export default async function handler(req, res) {
  const checkedAt = new Date().toISOString();

  const source = {
    name: "APHA Science Blog - Bee Health",
    organisation: "Animal and Plant Health Agency",
    url: "https://aphascience.blog.gov.uk/category/bee-health/"
  };

  try {
    const response = await fetch(source.url, {
      headers: {
        "User-Agent": "Hornet Alert UK/1.0"
      }
    });

    if (!response.ok) {
      throw new Error(`Source returned HTTP ${response.status}`);
    }

    const html = await response.text();

    const keywords = [
      "yellow-legged hornet",
      "yellow legged hornet",
      "asian hornet",
      "vespa velutina"
    ];

    const lowerHtml = html.toLowerCase();

    const matchedKeywords = keywords.filter(keyword =>
      lowerHtml.includes(keyword)
    );

    return res.status(200).json({
      ok: true,
      service: "Hornet Alert UK",
      checkedAt,
      source: {
        ...source,
        reachable: true
      },
      hornetContentDetected: matchedKeywords.length > 0,
      matchedKeywords,
      message:
        matchedKeywords.length > 0
          ? "Yellow-legged hornet content detected on official APHA source."
          : "Source checked successfully. No hornet keywords detected."
    });

  } catch (error) {
    return res.status(500).json({
      ok: false,
      service: "Hornet Alert UK",
      checkedAt,
      source,
      error: error.message
    });
  }
}
