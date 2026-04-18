const crypto = require('crypto');
const { load, save } = require('./storage');

function loadPosts() { return load('posts', []); }
function savePosts(p) { save('posts', p); }

function createPost({ author, content, visibility = 'public', audience = [] }) {
  if (!content || !content.trim()) throw new Error('Empty post');
  if (content.length > 500) throw new Error('Post too long');
  const posts = loadPosts();
  const post = {
    id: crypto.randomBytes(8).toString('hex'),
    author,
    content: content.trim(),
    visibility,
    audience,
    likes: [],
    comments: [],
    createdAt: Date.now(),
  };
  posts.unshift(post);
  savePosts(posts);
  return post;
}

function listPostsFor(username) {
  const posts = loadPosts();
  return posts.filter(p => {
    if (p.visibility === 'public') return true;
    if (p.author === username) return true;
    if (p.visibility === 'private') return p.audience.includes(username);
    return false;
  });
}

function postsByAuthor(author) {
  return loadPosts().filter(p => p.author === author && p.visibility === 'public');
}

function likePost(postId, username) {
  const posts = loadPosts();
  const post = posts.find(p => p.id === postId);
  if (!post) throw new Error('Post not found');
  const idx = post.likes.indexOf(username);
  if (idx === -1) post.likes.push(username);
  else post.likes.splice(idx, 1);
  savePosts(posts);
  return post;
}

function commentOnPost(postId, username, text) {
  if (!text || !text.trim()) throw new Error('Empty comment');
  const posts = loadPosts();
  const post = posts.find(p => p.id === postId);
  if (!post) throw new Error('Post not found');
  post.comments.push({ author: username, text: text.trim(), createdAt: Date.now() });
  savePosts(posts);
  return post;
}

module.exports = { createPost, listPostsFor, postsByAuthor, likePost, commentOnPost };
