'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle,
  AlertCircle,
  XCircle,
  Info,
  TrendingUp,
  Eye,
  Hash,
  Link,
  Image,
  FileText,
} from 'lucide-react';

interface SEOAnalysisProps {
  title: string;
  content: string;
  metaDescription?: string;
  slug?: string;
  featuredImage?: string;
  tags?: string[];
}

interface SEOCheck {
  id: string;
  name: string;
  status: 'success' | 'warning' | 'error' | 'info';
  message: string;
  score: number;
}

interface KeywordDensity {
  word: string;
  count: number;
  density: number;
}

export function SEOAnalyzer({
  title,
  content,
  metaDescription = '',
  slug = '',
  featuredImage = '',
  tags = [],
}: SEOAnalysisProps) {
  const [seoScore, setSeoScore] = useState(0);
  const [checks, setChecks] = useState<SEOCheck[]>([]);
  const [keywordDensity, setKeywordDensity] = useState<KeywordDensity[]>([]);
  const [readingTime, setReadingTime] = useState(0);
  const [wordCount, setWordCount] = useState(0);

  useEffect(() => {
    analyzeSEO();
  }, [title, content, metaDescription, slug, featuredImage, tags]);

  const analyzeSEO = () => {
    const plainContent = content.replace(/<[^>]*>/g, '');
    const words = plainContent.split(/\s+/).filter(word => word.length > 0);
    const wordCount = words.length;
    const readingTime = Math.ceil(wordCount / 200); // 200 words per minute

    setWordCount(wordCount);
    setReadingTime(readingTime);

    const checks: SEOCheck[] = [];
    let totalScore = 0;

    // Title checks
    if (title.length === 0) {
      checks.push({
        id: 'title-missing',
        name: 'Title Missing',
        status: 'error',
        message: 'Post title is required for SEO',
        score: 0,
      });
    } else if (title.length < 30) {
      checks.push({
        id: 'title-short',
        name: 'Title Too Short',
        status: 'warning',
        message: `Title is ${title.length} characters. Aim for 50-60 characters.`,
        score: 5,
      });
      totalScore += 5;
    } else if (title.length > 60) {
      checks.push({
        id: 'title-long',
        name: 'Title Too Long',
        status: 'warning',
        message: `Title is ${title.length} characters. Keep it under 60 characters.`,
        score: 5,
      });
      totalScore += 5;
    } else {
      checks.push({
        id: 'title-good',
        name: 'Title Length',
        status: 'success',
        message: `Title length (${title.length} chars) is optimal for SEO.`,
        score: 10,
      });
      totalScore += 10;
    }

    // Meta description checks
    if (metaDescription.length === 0) {
      checks.push({
        id: 'meta-missing',
        name: 'Meta Description Missing',
        status: 'error',
        message: 'Meta description is crucial for search results',
        score: 0,
      });
    } else if (metaDescription.length < 120) {
      checks.push({
        id: 'meta-short',
        name: 'Meta Description Too Short',
        status: 'warning',
        message: `Meta description is ${metaDescription.length} characters. Aim for 150-160 characters.`,
        score: 5,
      });
      totalScore += 5;
    } else if (metaDescription.length > 160) {
      checks.push({
        id: 'meta-long',
        name: 'Meta Description Too Long',
        status: 'warning',
        message: `Meta description is ${metaDescription.length} characters. Keep it under 160 characters.`,
        score: 5,
      });
      totalScore += 5;
    } else {
      checks.push({
        id: 'meta-good',
        name: 'Meta Description Length',
        status: 'success',
        message: `Meta description length (${metaDescription.length} chars) is optimal.`,
        score: 10,
      });
      totalScore += 10;
    }

    // Content length checks
    if (wordCount < 300) {
      checks.push({
        id: 'content-short',
        name: 'Content Too Short',
        status: 'warning',
        message: `Content has ${wordCount} words. Aim for at least 300 words for better SEO.`,
        score: 5,
      });
      totalScore += 5;
    } else {
      checks.push({
        id: 'content-good',
        name: 'Content Length',
        status: 'success',
        message: `Content length (${wordCount} words) is good for SEO.`,
        score: 10,
      });
      totalScore += 10;
    }

    // Slug checks
    if (slug.length === 0) {
      checks.push({
        id: 'slug-missing',
        name: 'URL Slug Missing',
        status: 'error',
        message: 'URL slug is required for SEO-friendly URLs',
        score: 0,
      });
    } else if (slug.length > 60) {
      checks.push({
        id: 'slug-long',
        name: 'URL Slug Too Long',
        status: 'warning',
        message: 'Keep URL slug under 60 characters for better readability',
        score: 5,
      });
      totalScore += 5;
    } else {
      checks.push({
        id: 'slug-good',
        name: 'URL Slug',
        status: 'success',
        message: 'URL slug is SEO-friendly',
        score: 10,
      });
      totalScore += 10;
    }

    // Featured image check
    if (featuredImage) {
      checks.push({
        id: 'image-present',
        name: 'Featured Image',
        status: 'success',
        message: 'Featured image helps with social sharing and engagement',
        score: 10,
      });
      totalScore += 10;
    } else {
      checks.push({
        id: 'image-missing',
        name: 'Featured Image Missing',
        status: 'warning',
        message: 'Consider adding a featured image for better social sharing',
        score: 5,
      });
      totalScore += 5;
    }

    // Tags check
    if (tags.length === 0) {
      checks.push({
        id: 'tags-missing',
        name: 'No Tags',
        status: 'warning',
        message: 'Add relevant tags to improve content discoverability',
        score: 5,
      });
      totalScore += 5;
    } else if (tags.length > 10) {
      checks.push({
        id: 'tags-many',
        name: 'Too Many Tags',
        status: 'warning',
        message: 'Consider using fewer, more relevant tags (5-8 is optimal)',
        score: 7,
      });
      totalScore += 7;
    } else {
      checks.push({
        id: 'tags-good',
        name: 'Tags',
        status: 'success',
        message: `Good number of tags (${tags.length}) for categorization`,
        score: 10,
      });
      totalScore += 10;
    }

    // Headings check
    const headingMatches = content.match(/<h[1-6][^>]*>/gi);
    if (!headingMatches || headingMatches.length === 0) {
      checks.push({
        id: 'headings-missing',
        name: 'No Headings',
        status: 'warning',
        message: 'Use headings (H1, H2, H3) to structure your content',
        score: 5,
      });
      totalScore += 5;
    } else {
      checks.push({
        id: 'headings-present',
        name: 'Content Structure',
        status: 'success',
        message: `Good use of headings (${headingMatches.length} found)`,
        score: 10,
      });
      totalScore += 10;
    }

    // Calculate keyword density
    const keywordDensity = calculateKeywordDensity(plainContent);
    setKeywordDensity(keywordDensity);

    const maxScore = checks.length * 10;
    const finalScore = Math.round((totalScore / maxScore) * 100);

    setSeoScore(finalScore);
    setChecks(checks);
  };

  const calculateKeywordDensity = (text: string): KeywordDensity[] => {
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3); // Only words longer than 3 characters

    const wordCount = words.length;
    const wordFreq: { [key: string]: number } = {};

    words.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });

    return Object.entries(wordFreq)
      .map(([word, count]) => ({
        word,
        count,
        density: (count / wordCount) * 100,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 keywords
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreStatus = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Needs Improvement';
    return 'Poor';
  };

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Info className="h-4 w-4 text-blue-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* SEO Score Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            SEO Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className={`text-3xl font-bold ${getScoreColor(seoScore)}`}>
                {seoScore}/100
              </div>
              <div className="text-sm text-gray-600">
                {getScoreStatus(seoScore)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600 mb-1">
                <Eye className="h-4 w-4 inline mr-1" />
                {readingTime} min read
              </div>
              <div className="text-sm text-gray-600">
                <FileText className="h-4 w-4 inline mr-1" />
                {wordCount} words
              </div>
            </div>
          </div>
          <Progress value={seoScore} className="h-2" />
        </CardContent>
      </Card>

      {/* SEO Checks */}
      <Card>
        <CardHeader>
          <CardTitle>SEO Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {checks.map((check) => (
              <div key={check.id} className="flex items-start gap-3 p-3 rounded-lg border">
                <StatusIcon status={check.status} />
                <div className="flex-1">
                  <div className="font-medium">{check.name}</div>
                  <div className="text-sm text-gray-600">{check.message}</div>
                </div>
                <Badge variant={check.status === 'success' ? 'default' : 'secondary'}>
                  {check.score}/10
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Keyword Density */}
      {keywordDensity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5" />
              Keyword Density
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {keywordDensity.slice(0, 8).map((keyword) => (
                <div key={keyword.word} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span className="font-medium">{keyword.word}</span>
                  <div className="text-right">
                    <div className="text-sm font-medium">{keyword.count}x</div>
                    <div className="text-xs text-gray-600">
                      {keyword.density.toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

