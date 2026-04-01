import { db } from './src/db.js';

console.log('运行通知模块迁移...');

try {
  // 迁移函数已经在db.js中定义
  const { migrateNotificationModule } = await import('./src/db.js');
  console.log('通知模块迁移完成！');
} catch (error) {
  console.error('迁移失败:', error);
  process.exit(1);
}

process.exit(0);
