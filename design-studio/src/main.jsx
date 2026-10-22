import { IS_STATIC, assetUrl } from "./config";
import React, { useState, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  Home,
  Folder,
  LayoutTemplate,
  Shapes,
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  ArrowUpRight,
  Bell,
  Settings,
  HelpCircle,
  Crown,
  Sparkles,
  Presentation,
  Instagram,
  Video,
  Printer,
  Globe,
  MoreHorizontal,
  Star,
  X,
  ArrowLeft,
  Download,
  Check,
  Type,
  Palette,
  Image,
  Upload,
  Menu,
  Trash2,
  Copy,
  Heart,
  SlidersHorizontal,
  Play,
  CheckCircle2,
  PanelLeftClose,
} from "lucide-react";
import "./styles.css";
import { Workspace, useWorkspace } from "./Workspace";
import CanvasEditor, { SharedDesign } from "./CanvasEditor";
import BrandKit from "./BrandKit";
const VideoStudio = React.lazy(() => import("./VideoStudio"));
import { uploadAsset } from "./api";
import { documentFromTemplate } from "./design";

const categories = [
  { name: "For you", icon: Sparkles, color: "purple" },
  { name: "Presentations", icon: Presentation, color: "orange" },
  { name: "Social media", icon: Instagram, color: "pink" },
  { name: "Video covers", icon: Video, color: "blue" },
  { name: "Print products", icon: Printer, color: "green" },
  { name: "Web mockups", icon: Globe, color: "cyan" },
  { name: "More", icon: Shapes, color: "gray" },
];
const templates = [
  {
    id: "ideas",
    title: "The next big idea",
    type: "Presentations",
    detail: "Presentation · 16:9",
    style: "ideas",
    text: "Ideas worth\nsharing.",
    sub: "A fresh perspective starts here.",
    color: "#eee8dd",
  },
  {
    id: "good",
    title: "A little daily inspiration",
    type: "Social media",
    detail: "Instagram post · Square",
    style: "good",
    text: "GOOD\nTHINGS\nTAKE TIME",
    sub: "A little reminder for your day",
    color: "#d6f281",
  },
  {
    id: "summer",
    title: "Slow summer stories",
    type: "Social media",
    detail: "Instagram post · Portrait",
    style: "summer",
    text: "A slower kind\nof summer.",
    sub: "LESS SCROLLING. MORE LIVING.",
    color: "#b8d8db",
  },
  {
    id: "forma",
    title: "Made to be remembered",
    type: "Print products",
    detail: "Brand board · A4",
    style: "forma",
    text: "forma",
    sub: "THOUGHTFUL DESIGN. EVERY DAY.",
    color: "#f0e9e0",
  },
  {
    id: "bloom",
    title: "Room to grow",
    type: "Web mockups",
    detail: "Website mockup · 1920 × 1080",
    style: "bloom",
    text: "Room to\ngrow.",
    sub: "GOOD THINGS START SMALL.",
    color: "#e6c4ff",
  },
  {
    id: "motion",
    title: "Make your next move",
    type: "Video covers",
    detail: "Video cover · 1920 × 1080",
    style: "motion",
    text: "MAKE\nYOUR MOVE.",
    sub: "THE FUTURE IS YOURS.",
    color: "#b9c8ff",
  },
];
function Artwork({ item, large = false }) {
  if (item.meta?.thumbnail)
    return (
      <img
        className="real-project-thumbnail"
        src={item.meta.thumbnail}
        alt={item.title}
      />
    );
  return (
    <div
      className={`artwork ${item.style} ${large ? "large" : ""}`}
      style={{
        backgroundColor: item.color,
        ...(large && item.width && item.height
          ? { aspectRatio: `${item.width} / ${item.height}` }
          : {}),
      }}
    >
      <div className="art-grain" />
      {item.style === "ideas" && (
        <>
          <div className="tiny-label">THE CREATIVE EDIT / 2026</div>
          <div className="idea-orbit">
            <span />
            <span />
            <span />
          </div>
        </>
      )}
      {item.style === "good" && (
        <>
          <div className="tiny-label">A NOTE TO SELF</div>
          <div className="flower">✳</div>
          <span className="good-dots">✦</span>
        </>
      )}
      {item.style === "summer" && (
        <>
          <img
            className="art-photo"
            src={assetUrl("images/ocean.jpg")}
            alt="Sunlit blue ocean"
          />
          <div className="sun-disc" />
          <div className="tiny-label">THE ART OF SLOWING DOWN</div>
        </>
      )}
      {item.style === "forma" && (
        <>
          <div className="tiny-label">A STUDIO FOR EVERYDAY LIVING</div>
          <div className="forma-objects">
            <div />
            <div />
            <div />
          </div>
        </>
      )}
      {item.style === "bloom" && <div className="bloom-flower">✿</div>}
      {item.style === "motion" && <div className="motion-circle" />}
      <div className="art-title">{item.text}</div>
      <div className="art-sub">{item.sub}</div>
      {item.style === "ideas" && (
        <div className="art-footer">
          YOUR VISION, BEAUTIFULLY TOLD <span>↗</span>
        </div>
      )}
      {item.style === "forma" && (
        <div className="forma-footer">Objects. Spaces. Stories.</div>
      )}
    </div>
  );
}
function App() {
  const [page, setPage] = useState("Home"),
    [category, setCategory] = useState("For you"),
    [query, setQuery] = useState(""),
    [modal, setModal] = useState(null),
    [editor, setEditor] = useState(null),
    [toast, setToast] = useState(""),
    [sidebar, setSidebar] = useState(false),
    [projectMenu, setProjectMenu] = useState(null),
    [projectFilter, setProjectFilter] = useState("All designs");
  const {
    user,
    projects,
    preferences,
    updatePreferences,
    save,
    remove,
    logout,
  } = useWorkspace();
  const { favorites, workspace } = preferences;
  const setFavorites = (value) =>
    updatePreferences({
      favorites: typeof value === "function" ? value(favorites) : value,
    }).catch((e) => notify(e.message));
  const setWorkspace = (value) =>
    updatePreferences({ workspace: value }).catch((e) => notify(e.message));
  const uploadRef = useRef();
  useEffect(() => {
    document.body.style.overflow = modal || editor ? "hidden" : "";
    document.body.classList.toggle("editor-active", Boolean(editor));
    return () => {
      document.body.style.overflow = "";
      document.body.classList.remove("editor-active");
    };
  }, [modal, Boolean(editor)]);
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement;
    const dialog = document.querySelector('[role="dialog"]');
    const controls = () =>
      [...dialog.querySelectorAll("button,input,textarea,summary")].filter(
        (el) => !el.disabled,
      );
    controls()[0]?.focus();
    const trap = (e) => {
      if (e.key !== "Tab") return;
      const list = controls();
      if (e.shiftKey && document.activeElement === list[0]) {
        e.preventDefault();
        list.at(-1)?.focus();
      } else if (!e.shiftKey && document.activeElement === list.at(-1)) {
        e.preventDefault();
        list[0]?.focus();
      }
    };
    dialog.addEventListener("keydown", trap);
    return () => {
      dialog.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [modal]);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.querySelector('input[aria-label="Search templates"]')?.focus();
      }
      if (e.key === "Escape") {
        setModal(null);
        setSidebar(false);
        setProjectMenu(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const notify = (text) => {
    setToast(text);
    setTimeout(() => setToast(""), 3200);
  };
  const duplicateProject = async (p) => {
    try {
      const document = p.document || (await documentFromTemplate(p));
      await save({
        ...p,
        id: undefined,
        revision: undefined,
        title: p.title + " (copy)",
        document,
      });
      notify("Design duplicated");
    } catch (e) {
      notify(e.message);
    }
  };
  const deleteProject = async (p) => {
    if (!window.confirm("Delete this design? This cannot be undone.")) return;
    try {
      if (p.revision) await remove(p.id);
      if (favorites.includes(p.id))
        await setFavorites(favorites.filter((id) => id !== p.id));
      notify("Design deleted");
    } catch (e) {
      notify(e.message);
    }
  };
  const navigate = (name) => {
    setPage(name);
    setQuery("");
    setCategory("For you");
    setSidebar(false);
  };
  const openEditor = (item) => {
    setEditor({ ...item });
    setModal(null);
  };
  const createBlank = (type = "Presentation", width = 1920, height = 1080) =>
    openEditor({
      width,
      height,
      id: Date.now().toString(),
      title: `Untitled ${type.toLowerCase()}`,
      text: "Your next\nbig idea.",
      sub: "MAKE SOMETHING GREAT.",
      style: "ideas",
      color: "#eee8dd",
      type,
      detail: type,
    });
  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const asset = await uploadAsset(file);
      setModal({ type: "upload", src: asset.url, name: asset.name });
    } catch (error) {
      notify(error.message);
    }
  };
  let filtered = templates.filter(
    (t) =>
      (category === "For you" || category === "More" || t.type === category) &&
      `${t.title} ${t.type} ${t.text}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const visibleProjects = (
    projectFilter === "Starred"
      ? [
          ...projects,
          ...templates.filter(
            (t) =>
              favorites.includes(t.id) && !projects.some((p) => p.id === t.id),
          ),
        ]
      : projects
  ).filter(
    (p) =>
      p.title.toLowerCase().includes(query.toLowerCase()) &&
      (projectFilter !== "Starred" || favorites.includes(p.id)),
  );
  return (
    <>
      <input
        ref={uploadRef}
        type="file"
        accept="image/*"
        hidden
        onChange={upload}
      />
      <aside
        className={`sidebar ${sidebar ? "is-open" : ""}`}
        inert={modal ? true : undefined}
      >
        <a className="logo" onClick={() => navigate("Home")}>
          Open Studio<span>✧</span>
        </a>
        <button className="workspace" onClick={() => setModal("workspace")}>
          <span className="workspace-avatar">{user.name[0].toUpperCase()}</span>
          <span>
            <b>{workspace}</b>
            <small>Free workspace</small>
          </span>
          <ChevronDown size={15} />
        </button>
        <button className="create-button" onClick={() => setModal("create")}>
          <Plus size={19} /> Create a design
        </button>
        <nav>
          {[
            { name: "Home", icon: Home },
            { name: "Projects", icon: Folder },
            { name: "Video studio", icon: Video },
            { name: "Templates", icon: LayoutTemplate },
            { name: "Brand", icon: Shapes },
            { name: "Apps", icon: Shapes },
          ].map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={page === name ? "active" : ""}
              onClick={() => navigate(name)}
            >
              <Icon size={20} />
              <span>{name}</span>
              {name === "Brand" && <Crown size={14} className="nav-crown" />}
              {name === "Apps" && <span className="new-label">NEW</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-divider" />
        <div className="workspace-section">
          <div className="side-label">
            YOUR WORKSPACE{" "}
            <button
              aria-label="Add a project"
              onClick={() => setModal("create")}
            >
              <Plus size={15} />
            </button>
          </div>
          <button
            className="side-link"
            onClick={() => {
              navigate("Projects");
              setProjectFilter("Starred");
            }}
          >
            <Star size={17} />
            Starred
          </button>
          <button
            className="side-link"
            onClick={() => {
              navigate("Projects");
              setProjectFilter("All designs");
            }}
          >
            <Folder size={17} />
            All your designs
          </button>
        </div>
        <div className="sidebar-bottom">
          <div className="pro-card">
            <div className="pro-card-icon">
              <Sparkles size={20} />
            </div>
            <b>A little more possibility</b>
            <p>
              Bring your big ideas to life
              <br />
              with no subscriptions.
            </p>
            <button onClick={() => setModal("pro")}>
              All tools are free <ArrowUpRight size={14} />
            </button>
          </div>
          <button className="bottom-link" onClick={() => setModal("help")}>
            <HelpCircle size={18} />
            Help & resources
            <ArrowUpRight size={14} />
          </button>
          <button className="profile" onClick={() => setModal("account")}>
            <span className="avatar">{user.name[0].toUpperCase()}</span>
            <span>
              <b>{user.name}'s workspace</b>
              <small>{IS_STATIC ? "Local workspace" : "Free account"}</small>
            </span>
            <MoreHorizontal size={19} />
          </button>
        </div>
      </aside>
      <main className="main" inert={modal ? true : undefined}>
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="mobile-menu icon-button"
              aria-label="Open menu"
              onClick={() => setSidebar(!sidebar)}
            >
              <Menu size={20} />
            </button>
            <span className="breadcrumb-icon">
              <Home size={15} />
            </span>
            <span>{workspace}</span>
            <ChevronRight size={13} />
            <b>{page}</b>
          </div>
          <div className="top-actions">
            <button className="upgrade" onClick={() => setModal("pro")}>
              <Crown size={15} />
              All tools free
            </button>
            <span className="top-divider" />
            <button
              className="icon-button notification"
              aria-label="Notifications"
              onClick={() => setModal("notifications")}
            >
              <Bell size={19} />
              <i />
            </button>
            <button
              className="avatar top-avatar"
              aria-label="Your account"
              onClick={() => setModal("account")}
            >
              S
            </button>
          </div>
        </header>
        <div className="page-content">
          {page === "Home" && (
            <>
              <section className="hero">
                <div className="hero-copy">
                  <div className="eyebrow">
                    <span /> A GOOD DAY TO MAKE SOMETHING
                  </div>
                  <h1>
                    A little idea.
                    <br />
                    Endless <em>possibilities.</em>
                  </h1>
                  <p>You've got the spark. We've got the tools.</p>
                  <button
                    className="hero-cta"
                    onClick={() => setModal("create")}
                  >
                    Let's create something <ArrowUpRight size={17} />
                  </button>
                </div>
                <div className="hero-art" aria-hidden="true">
                  <span className="hero-spark spark-one">✦</span>
                  <span className="hero-spark spark-two">✧</span>
                  <div className="hero-paper paper-back">
                    <span>MAKE IT</span>
                    <strong>yours.</strong>
                    <div className="paper-flower">✳</div>
                    <small>A LITTLE CREATIVITY GOES A LONG WAY</small>
                  </div>
                  <div className="hero-paper paper-photo">
                    <img src={assetUrl("images/ocean.jpg")} alt="" />
                    <span>
                      somewhere
                      <br />
                      <em>new.</em>
                    </span>
                    <small>LET YOUR CURIOSITY LEAD.</small>
                  </div>
                  <div className="floating-label">
                    <span>✦</span> Made by you.
                  </div>
                  <div className="hero-scribble">⌁</div>
                </div>
              </section>
            </>
          )}
          {(page === "Home" || page === "Templates") && (
            <>
              <section className="design-start">
                <div className="section-heading">
                  <h2>
                    {page === "Home"
                      ? "What will you create today?"
                      : "Find your next great idea"}
                  </h2>
                  {page === "Home" && (
                    <button
                      className="text-link"
                      onClick={() => setModal("custom")}
                    >
                      Custom size <Plus size={15} />
                    </button>
                  )}
                </div>
                <div className="search-box">
                  <Search size={20} />
                  <input
                    aria-label="Search templates"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search your ideas, or let inspiration find you"
                  />
                  <span className="search-shortcut">⌘ K</span>
                  {query && (
                    <button
                      className="icon-button"
                      aria-label="Clear search"
                      onClick={() => setQuery("")}
                    >
                      <X size={16} />
                    </button>
                  )}
                  <button
                    className="search-filter"
                    aria-label="Browse design types"
                    onClick={() => setModal("create")}
                  >
                    <SlidersHorizontal size={18} />
                  </button>
                </div>
                <div className="categories">
                  {categories.map(({ name, icon: Icon, color }) => (
                    <button
                      key={name}
                      className={`category ${category === name ? "selected" : ""}`}
                      onClick={() => {
                        if (name === "More") {
                          setModal("create");
                          return;
                        }
                        setCategory(name);
                      }}
                    >
                      <span className={`category-icon ${color}`}>
                        <Icon size={23} strokeWidth={1.7} />
                      </span>
                      <span>{name}</span>
                    </button>
                  ))}
                </div>
              </section>
              <section className="templates-section">
                <div className="section-heading">
                  <div>
                    <h2>
                      {query
                        ? `Results for “${query}”`
                        : category === "For you"
                          ? "A little inspiration for you"
                          : `${category} made easy`}
                    </h2>
                    <p>
                      {query
                        ? `${filtered.length} templates to make your own`
                        : "Fresh templates, ready for your personal touch."}
                    </p>
                  </div>
                  <button
                    className="text-link"
                    onClick={() => {
                      if (page === "Templates") {
                        setCategory("For you");
                        setQuery("");
                      } else navigate("Templates");
                    }}
                  >
                    {page === "Templates"
                      ? "All templates"
                      : "Explore all templates"}
                    <ArrowUpRight size={16} />
                  </button>
                </div>
                <div className="template-grid">
                  {(page === "Home" && category === "For you" && !query
                    ? filtered.slice(0, 4)
                    : filtered
                  ).map((item) => (
                    <div className="template-card" key={item.id}>
                      <button
                        className="art-button"
                        onClick={() => openEditor(item)}
                        aria-label={`Customize ${item.title}`}
                      >
                        <Artwork item={item} />
                        <span className="template-hover">
                          Customize this template <ArrowUpRight size={16} />
                        </span>
                      </button>
                      <button
                        className={`favorite ${favorites.includes(item.id) ? "is-favorite" : ""}`}
                        aria-label={`Star ${item.title}`}
                        onClick={() =>
                          setFavorites(
                            favorites.includes(item.id)
                              ? favorites.filter((x) => x !== item.id)
                              : [...favorites, item.id],
                          )
                        }
                      >
                        <Star
                          size={16}
                          fill={
                            favorites.includes(item.id)
                              ? "currentColor"
                              : "none"
                          }
                        />
                      </button>
                      <h3 onClick={() => openEditor(item)}>{item.title}</h3>
                      <p>{item.detail}</p>
                    </div>
                  ))}
                </div>
                {!filtered.length && (
                  <div className="empty-state">
                    <Search size={30} />
                    <h3>No templates found</h3>
                    <p>Try “social”, “presentation”, or a different idea.</p>
                    <button
                      onClick={() => {
                        setQuery("");
                        setCategory("For you");
                      }}
                    >
                      Show all templates
                    </button>
                  </div>
                )}
              </section>
            </>
          )}
          {(page === "Home" || page === "Projects") && (
            <section className="recent-section">
              <div className="section-heading">
                <div>
                  <h2>
                    {page === "Home"
                      ? "Pick up where you left off"
                      : "Your creative corner"}
                  </h2>
                  <p>
                    {page === "Home"
                      ? "Your next great idea is already in the making."
                      : "All your ideas, together in one place."}
                  </p>
                </div>
                <button
                  className="text-link"
                  onClick={() =>
                    page === "Home" ? navigate("Projects") : setModal("create")
                  }
                >
                  {page === "Home" ? "View all projects" : "New design"}
                  {page === "Home" ? (
                    <ChevronRight size={16} />
                  ) : (
                    <Plus size={16} />
                  )}
                </button>
              </div>
              {page === "Projects" && (
                <>
                  <div className="project-controls">
                    <div className="project-tabs">
                      {["All designs", "Starred"].map((x) => (
                        <button
                          className={projectFilter === x ? "active" : ""}
                          onClick={() => setProjectFilter(x)}
                          key={x}
                        >
                          {x}
                        </button>
                      ))}
                    </div>
                    <div className="project-search">
                      <Search size={16} />
                      <input
                        placeholder="Search your projects"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}
              <div className="recent-grid">
                {(page === "Home" ? projects.slice(0, 4) : visibleProjects).map(
                  (p) => (
                    <div className="recent-card" key={p.id}>
                      <button
                        className="recent-art"
                        onClick={() => openEditor(p)}
                      >
                        <Artwork item={p} />
                      </button>
                      <div className="recent-info">
                        <div>
                          <h3 onClick={() => openEditor(p)}>{p.title}</h3>
                          <p>{p.edited}</p>
                        </div>
                        <button
                          className="icon-button"
                          aria-label={`Options for ${p.title}`}
                          onClick={() =>
                            setProjectMenu(projectMenu === p.id ? null : p.id)
                          }
                        >
                          <MoreHorizontal size={19} />
                        </button>
                      </div>
                      {projectMenu === p.id && (
                        <div className="project-menu">
                          <button
                            onClick={() => {
                              duplicateProject(p);
                              setProjectMenu(null);
                            }}
                          >
                            <Copy size={15} />
                            Duplicate
                          </button>
                          <button
                            onClick={() => {
                              setFavorites([...favorites, p.id]);
                              setProjectMenu(null);
                              notify("Added to starred");
                            }}
                          >
                            <Star size={15} />
                            Star design
                          </button>
                          <button
                            onClick={() => {
                              deleteProject(p);
                              setProjectMenu(null);
                            }}
                          >
                            <Trash2 size={15} />
                            Delete design
                          </button>
                        </div>
                      )}
                    </div>
                  ),
                )}
              </div>
              {page === "Projects" && !visibleProjects.length && (
                <div className="empty-state">
                  <Folder size={32} />
                  <h3>
                    {projectFilter === "Starred"
                      ? "Your favorites live here"
                      : "A fresh start"}
                  </h3>
                  <p>
                    {projectFilter === "Starred"
                      ? "Star a design to save it here."
                      : "Create a design to start your collection."}
                  </p>
                </div>
              )}
            </section>
          )}
          {page === "Brand" && <BrandKit />}
          {page === "Video studio" && (
            <React.Suspense
              fallback={<p className="vs-loading">Loading video tools…</p>}
            >
              <VideoStudio />
            </React.Suspense>
          )}
          {page === "Apps" && (
            <section className="apps-page">
              <div className="section-heading">
                <div>
                  <h1>A few more creative superpowers.</h1>
                  <p>Make more of your ideas with tools that work together.</p>
                </div>
              </div>
              <div className="apps-grid">
                {[
                  {
                    name: "Uploads",
                    icon: Upload,
                    desc: "Bring your own photos and graphics into the picture.",
                    color: "#e9e0ff",
                    action: () => uploadRef.current.click(),
                  },
                  {
                    name: "Color studio",
                    icon: Palette,
                    desc: "Discover a palette that feels just like you.",
                    color: "#e3edcc",
                    action: () => setModal("palette"),
                  },
                  {
                    name: "Video editor",
                    icon: Video,
                    desc: "Trim clips, arrange your timeline, add music, and export a real MP4.",
                    color: "#e6d9f5",
                    action: () => navigate("Video studio"),
                  },
                  {
                    name: "Text studio",
                    icon: Type,
                    desc: "Turn your words into something worth looking at.",
                    color: "#ffe4db",
                    action: () => createBlank("Typography design"),
                  },
                ].map(({ name, icon: Icon, desc, color, action }) => (
                  <button className="app-card" onClick={action} key={name}>
                    <span style={{ background: color }}>
                      <Icon size={30} />
                    </span>
                    <h2>{name}</h2>
                    <p>{desc}</p>
                    <b>
                      Open app <ArrowUpRight size={16} />
                    </b>
                  </button>
                ))}
              </div>
            </section>
          )}
          <footer className="page-footer">
            <span>A little creativity changes everything.</span>
            <span>
              Made for your imagination <Sparkles size={13} />
            </span>
          </footer>
        </div>
      </main>
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div
            className={`modal ${modal === "create" ? "create-modal" : ""}`}
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              aria-label="Close dialog"
              onClick={() => setModal(null)}
            >
              <X size={20} />
            </button>
            {modal === "create" ? (
              <>
                <span className="modal-symbol">
                  <Sparkles size={25} />
                </span>
                <h2>Big idea? Start here.</h2>
                <p>Choose a canvas and make it your own.</p>
                <div className="create-options">
                  <button
                    onClick={() => {
                      setModal(null);
                      navigate("Video studio");
                    }}
                  >
                    <span className="category-icon blue">
                      <Video size={23} />
                    </span>
                    <span>
                      <b>Video editing</b>
                      <small>Timeline · trim · music · MP4 export</small>
                    </span>
                    <ChevronRight size={18} />
                  </button>
                  {categories.slice(1, 6).map(({ name, icon: Icon, color }) => (
                    <button
                      key={name}
                      onClick={() =>
                        createBlank(
                          name,
                          ...(name === "Social media"
                            ? [1080, 1080]
                            : name === "Print products"
                              ? [794, 1123]
                              : [1920, 1080]),
                        )
                      }
                    >
                      <span className={`category-icon ${color}`}>
                        <Icon size={23} />
                      </span>
                      <span>
                        <b>{name}</b>
                        <small>
                          {name === "Presentations"
                            ? "1920 × 1080 px"
                            : name === "Social media"
                              ? "1080 × 1080 px"
                              : name === "Video covers"
                                ? "1920 × 1080 px"
                                : name === "Web mockups"
                                  ? "1920 × 1080 px"
                                  : "210 × 297 mm"}
                        </small>
                      </span>
                      <ChevronRight size={18} />
                    </button>
                  ))}
                </div>
                <div className="modal-bottom-actions">
                  <button onClick={() => setModal("custom")}>
                    <Plus size={17} />
                    Custom size
                  </button>
                  <button onClick={() => uploadRef.current.click()}>
                    <Upload size={17} />
                    Upload a photo
                  </button>
                </div>
              </>
            ) : modal === "custom" ? (
              <>
                <h2>Your canvas, your rules.</h2>
                <p>Start with the dimensions you need.</p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const data = new FormData(e.target);
                    createBlank(
                      `${data.get("width")} × ${data.get("height")} design`,
                      Number(data.get("width")),
                      Number(data.get("height")),
                    );
                  }}
                >
                  <div className="dimension-inputs">
                    <label>
                      Width
                      <input
                        name="width"
                        type="number"
                        min="64"
                        max="4096"
                        defaultValue="1920"
                        required
                      />
                    </label>
                    <span>×</span>
                    <label>
                      Height
                      <input
                        name="height"
                        type="number"
                        min="64"
                        max="4096"
                        defaultValue="1080"
                        required
                      />
                    </label>
                    <span>px</span>
                  </div>
                  <button className="primary-button full" type="submit">
                    Create new design <ArrowUpRight size={17} />
                  </button>
                </form>
              </>
            ) : modal === "pro" ? (
              <>
                <span className="modal-symbol">
                  <Sparkles size={27} />
                </span>
                <h2>Every tool. No paywalls.</h2>
                <p>
                  All the features in Open Studio are free: editing, multiple
                  pages, uploads, brand kits, version history, design files, and
                  exports without watermarks.
                </p>
                <div className="demo-note">
                  This is your own independent workspace, not a Canva
                  subscription.{" "}
                  {IS_STATIC
                    ? "This edition runs locally in your browser with no rendering server. Save external backups regularly."
                    : "Hosting costs depend on where you run the server."}{" "}
                  AI generation and live collaboration are not implemented.
                  Video editing is available in Video studio.
                </div>
                <button
                  className="primary-button full"
                  onClick={() => {
                    setModal(null);
                    navigate("Templates");
                  }}
                >
                  Start designing <ArrowUpRight size={17} />
                </button>
              </>
            ) : modal === "workspace" ? (
              <>
                <h2>A space for your ideas.</h2>
                <p>Give your personal workspace a name.</p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setWorkspace(new FormData(e.target).get("name"));
                    setModal(null);
                    notify("Workspace updated");
                  }}
                >
                  <label className="form-label">
                    Workspace name
                    <input
                      name="name"
                      defaultValue={workspace}
                      required
                      maxLength="30"
                    />
                  </label>
                  <button type="submit" className="primary-button full">
                    Save workspace <Check size={17} />
                  </button>
                </form>
              </>
            ) : modal === "account" ? (
              <>
                <span className="avatar account-avatar">
                  {user.name[0].toUpperCase()}
                </span>
                <h2>Hello, {user.name}.</h2>
                <p>This is your personal creative space.</p>
                <div className="account-details">
                  <span>
                    Workspace<b>{workspace}</b>
                  </span>
                  <span>
                    Plan<b>Free creative workspace</b>
                  </span>
                  <span>
                    Saved designs<b>{projects.length} designs</b>
                  </span>
                </div>
                <button
                  className="primary-button full"
                  onClick={() => setModal("workspace")}
                >
                  Manage workspace <Settings size={16} />
                </button>
                <button
                  className="primary-button full account-logout"
                  onClick={IS_STATIC ? () => setModal(null) : logout}
                >
                  {IS_STATIC ? "Close account panel" : "Sign out"}
                </button>
              </>
            ) : modal === "notifications" ? (
              <>
                <span className="modal-symbol">
                  <Bell size={25} />
                </span>
                <h2>You're all caught up.</h2>
                <p>
                  No new notifications. Just a world of possibilities waiting
                  for you.
                </p>
                <button
                  className="primary-button full"
                  onClick={() => {
                    setModal(null);
                    navigate("Templates");
                  }}
                >
                  Find some inspiration <Sparkles size={16} />
                </button>
              </>
            ) : modal === "help" ? (
              <>
                <h2>A little helping hand.</h2>
                <p>Everything you need to get creating.</p>
                <div className="help-items">
                  <details open>
                    <summary>How do I create a design?</summary>
                    <p>
                      Choose “Create a design” for a blank canvas, or pick any
                      template to make it yours.
                    </p>
                  </details>
                  <details>
                    <summary>How do I save my work?</summary>
                    <p>
                      In the editor, click Save. Designs are stored in your
                      {IS_STATIC ? "browser workspace" : "server account"} and
                      appear in Projects. The editor also autosaves every 15
                      seconds.
                    </p>
                  </details>
                  <details>
                    <summary>Can I download my design?</summary>
                    <p>
                      Yes! Click Export in the editor to export a self-contained
                      SVG of your design. Open it in a browser to view it.
                    </p>
                  </details>
                </div>
              </>
            ) : modal === "brand" ? (
              <>
                <h2>Make your mark.</h2>
                <p>Name your brand to get a head start.</p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const name = new FormData(e.target).get("brand");
                    openEditor({
                      ...templates[3],
                      id: Date.now().toString(),
                      title: `${name} — Brand board`,
                      text: name,
                    });
                  }}
                >
                  <label className="form-label">
                    Brand name
                    <input
                      name="brand"
                      placeholder="Your brilliant brand"
                      required
                      maxLength="35"
                    />
                  </label>
                  <button className="primary-button full">
                    Create brand board <ArrowUpRight size={17} />
                  </button>
                </form>
              </>
            ) : modal === "palette" ? (
              <>
                <span className="modal-symbol">
                  <Palette size={25} />
                </span>
                <h2>Find your kind of color.</h2>
                <p>Click a palette to start a design.</p>
                <div className="palette-options">
                  {[
                    ["#d9e7cb", "#65835c", "#ede8d8", "#263c2c"],
                    ["#f3c9dd", "#a58adb", "#ffecc1", "#bb5b72"],
                    ["#b8d8db", "#e9e3d6", "#526b7e", "#e7b788"],
                  ].map((colors, i) => (
                    <button
                      key={i}
                      onClick={() =>
                        openEditor({
                          ...templates[0],
                          id: Date.now().toString(),
                          color: colors[0],
                          title: [
                            "Garden notes",
                            "Soft daydream",
                            "Coastal calm",
                          ][i],
                        })
                      }
                    >
                      {colors.map((c) => (
                        <span key={c} style={{ background: c }} />
                      ))}
                    </button>
                  ))}
                </div>
              </>
            ) : modal.type === "upload" ? (
              <>
                <h2>Your photo, a fresh start.</h2>
                <p>{modal.name}</p>
                <img
                  className="uploaded-preview"
                  src={modal.src}
                  alt="Your uploaded image"
                />
                <button
                  className="primary-button full"
                  onClick={() =>
                    openEditor({
                      ...templates[2],
                      id: Date.now().toString(),
                      title: modal.name.replace(/\.[^.]+$/, ""),
                      upload: modal.src,
                    })
                  }
                >
                  Use in a design <ArrowUpRight size={17} />
                </button>
              </>
            ) : null}
          </div>
        </div>
      )}
      {editor && (
        <CanvasEditor
          key={editor.id}
          project={editor}
          templates={templates}
          brand={preferences.brand}
          onSave={save}
          onClose={() => setEditor(null)}
        />
      )}
      {toast && (
        <div className="toast">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
    </>
  );
}
createRoot(document.getElementById("root")).render(
  !IS_STATIC && new URLSearchParams(location.search).has("share") ? (
    <SharedDesign />
  ) : (
    <Workspace>
      <App />
    </Workspace>
  ),
);
