from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps, ImageStat


ROOT = Path(__file__).resolve().parents[1]
FRAMES = ROOT / "demo-frames"
OUTPUT = ROOT.parent / "day7-1-明远湖大豆包-刘星宇-智能瞭望与智能问数系统v0.3版演示.mp4"
SIZE = (1280, 720)
FPS = 30

FRAME_SPECS = [
    ("01-portal-login.png", "前台登录：普通用户进入智能工作台"),
    ("02-smart-query.png", "智能问数：首页支持自然语言提问"),
    ("03-query-result.png", "智能问数：返回分析结论和业务数据图表"),
    ("04-ai-chat.png", "AI 问答：基于当前模型完成数据智能咨询"),
    ("05-agent-chat.png", "@文案专员：生成产品文案并自动记录任务"),
    ("06-digital-employees.png", "数字员工中心：文案、天气、采集三类员工"),
    ("07-employee-result.png", "@采集专员：输出可执行的数据采集方案"),
    ("08-reports.png", "报表呈现：趋势、数据源和模型效果报告"),
    ("09-tasks.png", "任务列表：追踪数字员工执行结果与进度"),
    ("10-models.png", "模型切换：按任务选择不同智能模型"),
    ("11-admin-login.png", "后台登录：管理员使用独立入口登录"),
    ("12-admin-dashboard.png", "后台工作台：核心业务数据与运行状态总览"),
    ("13-admin-users.png", "用户管理：维护账号、角色和启停状态"),
    ("14-admin-collections.png", "瞭望采集：维护任务、调度、入仓与运行状态"),
    ("15-admin-sources.png", "瞭源管理：统一维护多类型数据源连接"),
    ("16-admin-warehouse.png", "数据仓库：管理 ODS、DWD、DWS 数据资产"),
    ("17-admin-models.png", "模型引擎：维护模型版本、框架和准确率"),
    ("18-admin-employees.png", "数字员工管理：配置模型、提示词和启停状态"),
    ("19-admin-functions.png", "功能管理：维护接口权限点与请求方法"),
    ("20-admin-roles.png", "角色管理：分配功能权限和菜单范围"),
    ("21-admin-menus.png", "菜单管理：维护后台菜单层级与显示规则"),
]


def font(size):
    candidates = [Path("C:/Windows/Fonts/msyh.ttc"), Path("C:/Windows/Fonts/simhei.ttf")]
    target = next((item for item in candidates if item.exists()), None)
    return ImageFont.truetype(str(target), size) if target else ImageFont.load_default()


def title_frame():
    image = Image.new("RGB", SIZE, "#09263a")
    draw = ImageDraw.Draw(image)
    draw.ellipse((-120, -180, 520, 460), fill="#0d6b70")
    draw.ellipse((920, 390, 1450, 920), fill="#154964")
    draw.text((100, 190), "智能瞭望与智能问数系统", font=font(52), fill="white")
    draw.text((102, 270), "V0.3 前后台全功能演示 · 重录版", font=font(30), fill="#78ded4")
    draw.text((102, 335), "明远湖大豆包 · 刘星宇", font=font(22), fill="#b9d2d9")
    return cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)


def end_frame():
    image = Image.new("RGB", SIZE, "#0a2a3d")
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((90, 120, 1190, 600), radius=36, fill="#0d3b50", outline="#1a6c75", width=2)
    draw.text((150, 185), "演示完成", font=font(48), fill="white")
    draw.text((152, 270), "前台智能问数 + 后台权限与数据业务管理", font=font(28), fill="#79ded5")
    draw.text((152, 345), "21 个功能画面均已完成内容校验", font=font(23), fill="#c4d9df")
    draw.text((152, 405), "GitHub: Y3X1L2/intelligent-liaowang-v03", font=font(21), fill="#c4d9df")
    draw.text((152, 490), "明远湖大豆包 · 刘星宇", font=font(22), fill="white")
    return cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)


def validate_frame(path):
    image = Image.open(path).convert("RGB")
    grayscale = image.convert("L")
    deviation = ImageStat.Stat(grayscale).stddev[0]
    nonwhite = np.mean(np.asarray(grayscale) < 245)
    if deviation < 12 or nonwhite < 0.08:
        raise RuntimeError(f"检测到疑似空白帧：{path.name} (std={deviation:.2f}, coverage={nonwhite:.3f})")
    return image


def caption_frame(path, caption, index, total):
    source = validate_frame(path)
    image = ImageOps.fit(source, SIZE, method=Image.Resampling.LANCZOS)
    overlay = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.rounded_rectangle((36, 636, 1000, 698), radius=14, fill=(6, 31, 47, 224))
    draw.text((58, 652), caption, font=font(22), fill="white")
    draw.rounded_rectangle((1120, 646, 1244, 692), radius=12, fill=(13, 133, 122, 232))
    progress = f"{index:02d} / {total:02d}"
    draw.text((1141, 657), progress, font=font(17), fill="white")
    image = Image.alpha_composite(image.convert("RGBA"), overlay).convert("RGB")
    return cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)


def main():
    missing = [name for name, _ in FRAME_SPECS if not (FRAMES / name).exists()]
    if missing:
        raise RuntimeError(f"缺少演示截图：{', '.join(missing)}")
    total = len(FRAME_SPECS)
    frames = [title_frame()]
    frames.extend(caption_frame(FRAMES / name, caption, index, total) for index, (name, caption) in enumerate(FRAME_SPECS, 1))
    frames.append(end_frame())
    writer = cv2.VideoWriter(str(OUTPUT), cv2.VideoWriter_fourcc(*"mp4v"), FPS, SIZE)
    if not writer.isOpened():
        raise RuntimeError("无法初始化 MP4 编码器")
    hold = int(1.8 * FPS)
    fade = int(0.25 * FPS)
    for index, current in enumerate(frames):
        for _ in range(hold):
            writer.write(current)
        if index + 1 < len(frames):
            following = frames[index + 1]
            for step in range(1, fade + 1):
                alpha = step / (fade + 1)
                writer.write(cv2.addWeighted(current, 1 - alpha, following, alpha, 0))
    writer.release()
    print(OUTPUT)


if __name__ == "__main__":
    main()
