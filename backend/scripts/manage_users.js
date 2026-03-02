#!/usr/bin/env node
/**
 * 用户管理脚本 - 查询和管理 Supabase 用户
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://dhrobrmaktietyinlluv.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRocm9icm1ha3RpZXR5aW5sbHV2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzA4NDE1MCwiZXhwIjoyMDgyNjYwMTUwfQ.7nloquj_x_m8gweqrcpKIt1BUvQwa93TedVpgNfTB5E';

// 创建 Admin Client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function listUsers() {
  console.log('\n=== 查询所有用户 ===\n');

  // 通过 RPC 调用或者直接查询 auth.users（如果 service_role 有权限）
  const { data, error } = await supabase.auth.admin.listUsers();

  if (error) {
    console.error('查询用户失败:', error);
    return;
  }

  console.log(`找到 ${data.users.length} 个用户:\n`);

  data.users.forEach((user, index) => {
    console.log(`${index + 1}. ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Created: ${user.created_at}`);
    console.log(`   Last Sign In: ${user.last_sign_in_at || 'Never'}`);
    console.log(`   Phone: ${user.phone || 'N/A'}`);
    console.log('');
  });
}

async function findUserByEmail(email) {
  console.log(`\n=== 查询用户: ${email} ===\n`);

  const { data, error } = await supabase.auth.admin.listUsers();

  if (error) {
    console.error('查询用户失败:', error);
    return null;
  }

  const user = data.users.find(u => u.email === email);

  if (user) {
    console.log('找到用户:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Created: ${user.created_at}`);
    console.log(`   Last Sign In: ${user.last_sign_in_at || 'Never'}`);
    console.log(`   Email Confirmed: ${user.email_confirmed_at ? 'Yes' : 'No'}`);
    return user;
  } else {
    console.log('未找到该用户');
    return null;
  }
}

async function deleteUser(userId) {
  console.log(`\n=== 删除用户: ${userId} ===\n`);

  const { data, error } = await supabase.auth.admin.deleteUser(userId);

  if (error) {
    console.error('删除用户失败:', error);
    return false;
  }

  console.log('用户已成功删除');
  return true;
}

async function updateUserPassword(userId, newPassword) {
  console.log(`\n=== 更新用户密码 ===\n`);

  const { data, error } = await supabase.auth.admin.updateUserById(userId, {
    password: newPassword
  });

  if (error) {
    console.error('更新密码失败:', error);
    return false;
  }

  console.log('密码已成功更新');
  return true;
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'list':
      await listUsers();
      break;

    case 'find':
      if (!args[1]) {
        console.error('请提供邮箱地址');
        process.exit(1);
      }
      await findUserByEmail(args[1]);
      break;

    case 'delete':
      if (!args[1]) {
        console.error('请提供用户ID');
        process.exit(1);
      }
      await deleteUser(args[1]);
      break;

    case 'update-password':
      if (!args[1] || !args[2]) {
        console.error('用法: update-password <user_id> <new_password>');
        process.exit(1);
      }
      await updateUserPassword(args[1], args[2]);
      break;

    default:
      console.log(`
用户管理脚本

用法:
  node scripts/manage_users.js list              - 列出所有用户
  node scripts/manage_users.js find <email>      - 查找指定邮箱的用户
  node scripts/manage_users.js delete <user_id>  - 删除指定用户
  node scripts/manage_users.js update-password <user_id> <new_password> - 更新用户密码

示例:
  node scripts/manage_users.js list
  node scripts/manage_users.js find 2307294809@qq.com
      `);
  }
}

main().catch(console.error);
