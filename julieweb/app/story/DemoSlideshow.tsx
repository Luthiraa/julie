"use client";

import { useState } from "react";
import styles from "./page.module.css";

interface DemoSlide {
    src: string;
    caption: string;
}

const demos: DemoSlide[] = [
    {
        src: "/demo-export-1767568087250.mp4",
        caption: "The Builder — creating a Three.js project from scratch"
    },
    {
        src: "/demo-export-1767582082162.mp4",
        caption: "The Ghost Writer — coding while invisible"
    },
    {
        src: "/demo-export-1767588790108.mp4",
        caption: "The Journal — Notes and Calendar automation"
    }
];

export default function DemoSlideshow() {
    const [currentSlide, setCurrentSlide] = useState(0);

    const goToSlide = (index: number) => {
        setCurrentSlide(index);
    };

    const prevSlide = () => {
        setCurrentSlide((prev) => (prev === 0 ? demos.length - 1 : prev - 1));
    };

    const nextSlide = () => {
        setCurrentSlide((prev) => (prev === demos.length - 1 ? 0 : prev + 1));
    };

    return (
        <div className={styles.slideshow}>
            <p className={styles.slideshowTitle}>Watch the Demos</p>

            <div className={styles.slideContainer}>
                <video
                    key={demos[currentSlide].src}
                    className={styles.slideVideo}
                    autoPlay
                    loop
                    muted
                    playsInline
                >
                    <source src={demos[currentSlide].src} type="video/mp4" />
                </video>

                <button
                    className={`${styles.slideNav} ${styles.slideNavPrev}`}
                    onClick={prevSlide}
                    aria-label="Previous slide"
                >
                    ←
                </button>

                <button
                    className={`${styles.slideNav} ${styles.slideNavNext}`}
                    onClick={nextSlide}
                    aria-label="Next slide"
                >
                    →
                </button>
            </div>

            <p className={styles.slideCaption}>{demos[currentSlide].caption}</p>

            <div className={styles.slideDots}>
                {demos.map((_, index) => (
                    <button
                        key={index}
                        className={`${styles.slideDot} ${index === currentSlide ? styles.slideDotActive : ""}`}
                        onClick={() => goToSlide(index)}
                        aria-label={`Go to slide ${index + 1}`}
                    />
                ))}
            </div>
        </div>
    );
}
