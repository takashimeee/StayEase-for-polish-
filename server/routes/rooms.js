const { refreshRoomRankings } = require('../services/roomRanking');

// Public: rooms sorted by positive reviews
router.get('/recommended', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT room_id, room_name, room_type, base_price, ai_sentiment_score, ai_summary
      FROM rooms
      WHERE is_active = 1 AND ai_sentiment_score IS NOT NULL
      ORDER BY ai_sentiment_score DESC
      LIMIT 6
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load recommended rooms' });
  }
});

// Admin only: trigger re-analysis (add your admin auth middleware)
router.post('/recommended/refresh', /* requireAdmin, */ async (req, res) => {
  try {
    res.json(await refreshRoomRankings());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});