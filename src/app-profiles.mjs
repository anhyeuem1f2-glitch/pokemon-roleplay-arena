export const APP_PROFILES = {
  generic: {
    id: 'generic',
    name: 'Web game thông thường',
    description: 'Luồng trình duyệt tổng quát, mỗi browser dùng profile sạch riêng.',
    defaultSteps: 16,
    responseTimeoutMs: 90_000,
    sharedServerState: false,
    mission: 'Đi qua luồng chính như người chơi thật. Tìm lỗi chức năng, giao diện, accessibility, console, network và mất trạng thái. Không thực hiện hành động phá huỷ.'
  },
  'trainer-arena': {
    id: 'trainer-arena',
    name: 'Trainer Arena · AI roleplay',
    description: 'Tối ưu cho wizard nhân vật, roleplay streaming, battle và state trong localStorage/IndexedDB.',
    defaultSteps: 40,
    responseTimeoutMs: 180_000,
    sharedServerState: false,
    mission: 'Đóng vai người chơi mới. Tạo nhân vật, gửi ít nhất ba hành động roleplay, kiểm tra chính văn không kể lặp hoặc tự quyết định thay người chơi. Đối chiếu DNA/state với nội dung đã xảy ra, thử battle nếu xuất hiện, reload để xác nhận lịch sử và state vẫn được giữ. Nếu gặp ô khoá API, dùng fill_secret với secret phù hợp; không yêu cầu hoặc hiển thị giá trị secret.'
  },
  quybi: {
    id: 'quybi',
    name: 'Sân Khấu Quỷ Bí · AI roleplay',
    description: 'Tối ưu cho streaming, update state, retry và save dùng chung phía server. Mỗi target instance chỉ chạy một browser tại một thời điểm.',
    defaultSteps: 50,
    responseTimeoutMs: 180_000,
    sharedServerState: true,
    mission: 'Đóng vai người chơi mới. Tạo nhân vật và chọn một con đường, gửi nhiều hành động roleplay rồi kiểm tra action không bị lặp. Đối chiếu thời gian, tiền, vật phẩm, NPC, quan hệ và thăng bậc với chính văn; mỗi update chỉ được áp đúng một lần và đúng con đường. Kiểm tra retry không nhân đôi action, response bị cụt không được lưu thành công và reload giữ đúng save. Nếu gặp ô khoá API, dùng fill_secret với secret phù hợp; không yêu cầu hoặc hiển thị giá trị secret. Không thử SSRF, không đọc file nhạy cảm và không dùng save chính.'
  }
};

export function getAppProfile(id) {
  const profile = APP_PROFILES[id || 'generic'];
  if (!profile) throw new Error(`Unknown app profile: ${id}`);
  return structuredClone(profile);
}

export function publicAppProfiles() {
  return Object.values(APP_PROFILES).map((profile) => structuredClone(profile));
}

export function profileAgentInstructions(profile) {
  profile ||= APP_PROFILES.generic;
  if (profile.id === 'trainer-arena') {
    return `This is Trainer Arena, an AI roleplay game. After submitting a roleplay action, use wait_until_idle before judging the response. Check that narrative-supported tags and deterministic Pokemon/battle state agree, that the model does not act for the player, and that reload preserves browser-local state. LocalStorage and IndexedDB values are intentionally not exposed; use visible state and storage metadata only.`;
  }
  if (profile.id === 'quybi') {
    return `This is San Khau Quy Bi, an AI roleplay game with server-shared saves. After submitting an action, use wait_until_idle before judging the response. Look for duplicated player actions, partial streams accepted as success, retry duplication, rejected updates still applied, wrong-path rank advancement, time jumps, and save loss after reload. Do not probe private files or SSRF. Runs against the same target instance are serialized by the harness.`;
  }
  return 'Use wait_until_idle when the product is generating or streaming a long response.';
}
