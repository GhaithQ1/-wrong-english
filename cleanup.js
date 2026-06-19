const mongoose = require('mongoose');
const Topic = require('./models/Topic');
const UserProgress = require('./models/UserProgress');

async function main() {
  await mongoose.connect('mongodb+srv://ghaith:0Z7M16Rg15agYGFG@cluster0.pcolro1.mongodb.net/wrong-english');
  
  const oldTopics = await Topic.find({ name: { $in: ['gregerg', 'Test Topic'] } });
  for (const t of oldTopics) {
    await UserProgress.deleteMany({ topic: t._id });
    console.log('Deleted progress for:', t.name, t._id);
  }
  const del = await Topic.deleteMany({ name: { $in: ['gregerg', 'Test Topic'] } });
  console.log('Deleted topics:', del.deletedCount);
  
  await Topic.findByIdAndUpdate('6a2fbb1a34e52dc31a730ff7', { order: 1 });
  await Topic.findByIdAndUpdate('6a2fbb1a34e52dc31a731030', { order: 2 });
  console.log('Orders updated');
  
  const remaining = await Topic.find().sort('order');
  remaining.forEach(t => console.log(t.order, t.name, t.sections ? t.sections.length : 0, 'sections'));
  
  await mongoose.disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
